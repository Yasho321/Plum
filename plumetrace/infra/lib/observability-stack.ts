/**
 * OWNER    : Tejas
 * DUE      : D3 12:00
 * TASK     :
 *   ObservabilityStack: CloudWatch dashboard (EngineRun duration, failures, data freshness) + alarms -> SNS email.
 * DONE WHEN: Dashboard link in README; a forced failure sends an email.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP  (synth-clean; "forced failure sends an email" verifies on deploy with a confirmed SNS subscription)
 */
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import { appConfig, Stage } from "./config";
import type { EngineStack } from "./engine-stack";

export interface ObservabilityStackProps extends cdk.StackProps {
  stage: Stage;
  engine: EngineStack;
  /** Email for alarm notifications; pass via `-c alarmEmail=...` or stack props. */
  alarmEmail?: string;
}

export class ObservabilityStack extends cdk.Stack {
  public readonly dashboard: cw.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);
    const cfg = appConfig(props.stage, this.account);
    const sm = props.engine.stateMachine;

    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `${cfg.prefix}-alarms`,
      displayName: "PlumeTrace alarms",
    });
    const email = props.alarmEmail ?? this.node.tryGetContext("alarmEmail");
    if (email) {
      this.alarmTopic.addSubscription(new subs.EmailSubscription(email));
    }

    // Alarm: any EngineRun failure.
    const failed = sm.metricFailed({ period: cdk.Duration.minutes(5), statistic: "Sum" });
    const failAlarm = new cw.Alarm(this, "EngineRunFailed", {
      alarmName: `${cfg.prefix}-enginerun-failed`,
      metric: failed,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    failAlarm.addAlarmAction(new cwActions.SnsAction(this.alarmTopic));

    // Alarm: run took too long (AC1 wants < 15 min).
    const duration = sm.metricTime({ period: cdk.Duration.minutes(5), statistic: "Maximum" });
    const slowAlarm = new cw.Alarm(this, "EngineRunSlow", {
      alarmName: `${cfg.prefix}-enginerun-slow`,
      metric: duration,
      threshold: cdk.Duration.minutes(15).toMilliseconds(),
      evaluationPeriods: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    slowAlarm.addAlarmAction(new cwActions.SnsAction(this.alarmTopic));

    // Dashboard: run health + data freshness.
    this.dashboard = new cw.Dashboard(this, "Dashboard", {
      dashboardName: `${cfg.prefix}-plumetrace`,
    });
    this.dashboard.addWidgets(
      new cw.GraphWidget({
        title: "EngineRun duration (ms)",
        left: [sm.metricTime({ statistic: "Maximum" })],
        width: 12,
      }),
      new cw.GraphWidget({
        title: "EngineRun outcomes",
        left: [sm.metricSucceeded({ statistic: "Sum" }), sm.metricFailed({ statistic: "Sum" })],
        width: 12,
      }),
    );
    // Data freshness: emitted by the engine as a custom metric (hours since last run).
    this.dashboard.addWidgets(
      new cw.SingleValueWidget({
        title: "Data freshness (h since last publish)",
        metrics: [
          new cw.Metric({
            namespace: "PlumeTrace",
            metricName: "HoursSinceLastPublish",
            dimensionsMap: { stage: props.stage },
            statistic: "Maximum",
          }),
        ],
        width: 12,
      }),
    );

    new cdk.CfnOutput(this, "DashboardName", { value: this.dashboard.dashboardName });
    new cdk.CfnOutput(this, "AlarmTopicArn", { value: this.alarmTopic.topicArn });
  }
}
