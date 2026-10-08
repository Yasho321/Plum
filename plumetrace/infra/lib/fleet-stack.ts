/**
 * OWNER    : Tejas
 * DUE      : D2 18:00
 * TASK     :
 *   FleetStack: dose Lambda (Python container, ONLY role with kms:Decrypt on RiderHealth), re-planner (container, OR-Tools), Amazon Location route calculator + map + API key, RouteCache grants, rule on forecast.published.
 * DONE WHEN: Replanner invocable with mocks/fleet input; AC8 health-data scoping holds.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP  (tsc-clean; needs fleet/Dockerfile (handoff #11, Khare) + Docker daemon to synth/deploy)
 */
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as location from "aws-cdk-lib/aws-location";
import { appConfig, Stage } from "./config";
import type { DataStack } from "./data-stack";

const REPO_ROOT = path.join(__dirname, "..", "..");

export interface FleetStackProps extends cdk.StackProps {
  stage: Stage;
  data: DataStack;
  busName: string;
}

export class FleetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FleetStackProps) {
    super(scope, id, props);
    const cfg = appConfig(props.stage, this.account);
    const { data } = props;
    const bus = events.EventBus.fromEventBusName(this, "Bus", props.busName);

    // Amazon Location: route calculator + map + a restricted API key (brief §13.3).
    const routeCalculator = new location.CfnRouteCalculator(this, "RouteCalculator", {
      calculatorName: `${cfg.prefix}-routes`,
      dataSource: "Esri",
    });
    const map = new location.CfnMap(this, "Map", {
      mapName: `${cfg.prefix}-map`,
      configuration: { style: "VectorEsriNavigation" },
    });
    const apiKey = new location.CfnAPIKey(this, "LocationApiKey", {
      keyName: `${cfg.prefix}-location-key`,
      noExpiry: true,
      restrictions: {
        allowActions: ["geo:GetMap*", "geo:CalculateRouteMatrix"],
        allowResources: [routeCalculator.attrArn, map.attrArn],
      },
    });

    const commonEnv: Record<string, string> = {
      PT_STAGE: props.stage,
      PT_BUCKET: data.bucket.bucketName,
      PT_EVENT_BUS: props.busName,
      PT_TABLE_RIDERS: cfg.tables.Riders,
      PT_TABLE_RIDERHEALTH: cfg.tables.RiderHealth,
      PT_TABLE_SHIFTS: cfg.tables.Shifts,
      PT_TABLE_ROUTECACHE: cfg.tables.RouteCache,
      PT_TABLE_STATION: cfg.tables.StationForecast,
      PT_ROUTE_CALCULATOR: routeCalculator.calculatorName!,
    };

    // Both Lambdas are Python containers (ortools/scipy). fleet/Dockerfile is Khare's (handoff #11).
    const image = (handlerCmd: string) =>
      lambda.DockerImageCode.fromImageAsset(REPO_ROOT, { file: "fleet/Dockerfile", cmd: [handlerCmd] });

    // dose: the ONLY principal allowed to decrypt RiderHealth (AC8, brief §15).
    const doseFn = new lambda.DockerImageFunction(this, "DoseFn", {
      functionName: `${cfg.prefix}-dose`,
      code: image("fleet.dose.handler.handler"),
      memorySize: 2048,
      timeout: cdk.Duration.minutes(5),
      environment: commonEnv,
    });
    data.tables.Riders.grantReadData(doseFn);
    data.tables.RiderHealth.grantReadData(doseFn);
    data.tables.Shifts.grantReadWriteData(doseFn);
    data.tables.StationForecast.grantReadData(doseFn);
    data.bucket.grantRead(doseFn);
    data.riderHealthKey.grantDecrypt(doseFn); // scoped to dose only

    const replannerFn = new lambda.DockerImageFunction(this, "ReplannerFn", {
      functionName: `${cfg.prefix}-replanner`,
      code: image("fleet.replanner.handler.handler"),
      memorySize: 3008,
      timeout: cdk.Duration.minutes(5),
      environment: commonEnv,
    });
    data.tables.Riders.grantReadData(replannerFn);
    data.tables.Shifts.grantReadWriteData(replannerFn);
    data.tables.RouteCache.grantReadWriteData(replannerFn);
    data.tables.StationForecast.grantReadData(replannerFn);
    data.bucket.grantReadWrite(replannerFn);
    replannerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["geo:CalculateRouteMatrix", "geo:CalculateRoute"],
      resources: [routeCalculator.attrArn],
    }));

    // forecast.published -> re-plan tomorrow's doses (brief §8.3 rule 2).
    new events.Rule(this, "OnForecastPublished", {
      ruleName: `${cfg.prefix}-fleet-on-forecast`,
      eventBus: bus,
      eventPattern: { source: ["plumetrace.engine"], detailType: ["forecast.published"] },
      targets: [new targets.LambdaFunction(doseFn)],
    });

    new cdk.CfnOutput(this, "DoseArn", { value: doseFn.functionArn });
    new cdk.CfnOutput(this, "ReplannerArn", { value: replannerFn.functionArn });
    new cdk.CfnOutput(this, "MapName", { value: map.mapName! });
    new cdk.CfnOutput(this, "LocationApiKeyName", { value: apiKey.keyName! });
  }
}
