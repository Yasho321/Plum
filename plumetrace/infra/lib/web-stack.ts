/**
 * OWNER    : Tejas
 * DUE      : D2 18:00
 * TASK     :
 *   WebStack: host the React/Vite SPA. Brief allows Amplify Hosting OR S3 + CloudFront; we use S3 + CloudFront (OAC, SPA rewrites) because it needs no alpha CDK module and synths without Docker. CI syncs web/dist to the bucket.
 * DONE WHEN: Push to main -> live site in < 5 min.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP  (synth-clean; "live site" verifies on deploy + a `web/dist` sync from CI)
 */
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { appConfig, Stage } from "./config";

export interface WebStackProps extends cdk.StackProps {
  stage: Stage;
}

export class WebStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const cfg = appConfig(props.stage, this.account);
    const isDemo = props.stage === "demo";

    this.siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `${cfg.prefix}-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // served only via CloudFront OAC
      enforceSSL: true,
      removalPolicy: isDemo ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isDemo,
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // SPA: let the client router handle deep links.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(5) },
      ],
      comment: `PlumeTrace web ${props.stage}`,
    });

    new cdk.CfnOutput(this, "SiteBucketName", { value: this.siteBucket.bucketName });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${this.distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "DistributionId", { value: this.distribution.distributionId });
  }
}
