/**
 * OWNER    : Tejas
 * DUE      : D1 18:00
 * TASK     :
 *   Cognito user pool + Hosted UI domain + groups gov/fleet/admin + app client (callback = Amplify URL + localhost:5173). DockerImageFunction from api/Dockerfile (Bun + AWS Lambda Web Adapter, response streaming enabled for /agent/chat). HTTP API with JWT authorizer -> Lambda proxy. Pass env: table names, bucket, bus, guardrail id, lambda ARNs of Khare/Yasho2 tool Lambdas.
 * DONE WHEN: Tanmay can hit https://<api>/runs/latest with a Cognito token (MOCK_MODE=1 on D1).
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP
 *   Cognito + HTTP API + JWT authorizer are written and type-check. Full `cdk synth`
 *   waits on api/Dockerfile (Yasho2, still a stub) + the Docker daemon, since the API
 *   Lambda is a DockerImageFunction. MOCK_MODE=1 is passed on dev so D1 works on mocks.
 */
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { appConfig, Stage } from "./config";
import type { DataStack } from "./data-stack";

const REPO_ROOT = path.join(__dirname, "..", "..");
const GROUPS = ["gov", "fleet", "admin"] as const;

export interface ApiStackProps extends cdk.StackProps {
  stage: Stage;
  data: DataStack;
  busName?: string;
  /** Web origin(s) allowed to call the API and used as Cognito callback URLs. */
  webOrigins?: string[];
  /** Bedrock guardrail id + version from AgentStack (Yasho2), passed through to the API. */
  guardrailId?: string;
  guardrailVersion?: string;
  /** ARNs of Khare/Yasho2 tool Lambdas the agent may invoke. */
  toolLambdaArns?: Record<string, string>;
}

export class ApiStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const cfg = appConfig(props.stage, this.account);
    const { data } = props;
    const webOrigins = props.webOrigins ?? ["http://localhost:5173"];

    // --- Cognito ------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${cfg.prefix}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: true },
      removalPolicy: props.stage === "demo" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.userPool.addDomain("HostedUi", {
      cognitoDomain: { domainPrefix: `${cfg.prefix}-${this.account}` },
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      userPoolClientName: `${cfg.prefix}-web`,
      authFlows: { userPassword: true, userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: webOrigins,
        logoutUrls: webOrigins,
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
    });

    for (const g of GROUPS) {
      new cognito.CfnUserPoolGroup(this, `Group-${g}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: g,
      });
      // One demo user per group. Passwords are NOT committed — set post-deploy with
      // `aws cognito-idp admin-set-user-password` (see infra/README.md).
      const user = new cognito.CfnUserPoolUser(this, `User-${g}`, {
        userPoolId: this.userPool.userPoolId,
        username: `${g}@plumetrace.demo`,
        messageAction: "SUPPRESS",
        userAttributes: [{ name: "email", value: `${g}@plumetrace.demo` }, { name: "email_verified", value: "true" }],
      });
      new cognito.CfnUserPoolUserToGroupAttachment(this, `Attach-${g}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: g,
        username: user.ref,
      }).addDependency(user);
    }

    // --- API container Lambda (Bun + Lambda Web Adapter) --------------------
    const apiFn = new lambda.DockerImageFunction(this, "ApiFn", {
      functionName: `${cfg.prefix}-api`,
      code: lambda.DockerImageCode.fromImageAsset(REPO_ROOT, { file: "api/Dockerfile" }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PT_STAGE: props.stage,
        MOCK_MODE: props.stage === "dev" ? "1" : "0",
        PT_BUCKET: data.bucket.bucketName,
        PT_EVENT_BUS: props.busName ?? cfg.busName,
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
        ...Object.fromEntries(Object.entries(cfg.tables).map(([k, v]) => [`PT_TABLE_${k.toUpperCase()}`, v])),
        ...(props.guardrailId ? { BEDROCK_GUARDRAIL_ID: props.guardrailId } : {}),
        ...(props.guardrailVersion ? { BEDROCK_GUARDRAIL_VERSION: props.guardrailVersion } : {}),
        ...(props.toolLambdaArns ?? {}),
      },
    });
    data.bucket.grantReadWrite(apiFn);
    for (const t of Object.values(data.tables)) t.grantReadWriteData(apiFn);

    // A Function URL with response streaming for SSE (/agent/chat) — see YASHO2 §7.
    const streamingUrl = apiFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // --- HTTP API + Cognito JWT authorizer ---------------------------------
    const authorizer = new HttpJwtAuthorizer(
      "JwtAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      { jwtAudience: [this.userPoolClient.userPoolClientId] },
    );

    this.httpApi = new HttpApi(this, "HttpApi", {
      apiName: `${cfg.prefix}-api`,
      corsPreflight: {
        allowOrigins: webOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
        allowHeaders: ["authorization", "content-type"],
      },
    });
    this.httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("ApiIntegration", apiFn),
      authorizer,
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "AgentStreamUrl", { value: streamingUrl.url });
  }
}
