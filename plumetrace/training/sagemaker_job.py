"""
OWNER    : Yasho1
DUE      : optional
TASK     :
  Optional: launch train.py as a SageMaker script-mode job on ml.m5.xlarge (looks good on the architecture slide). Skip if local training is fast enough.
DONE WHEN: -
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE

Usage:
  # Local training (default) — reads features via s3io (PT_LOCAL reads ./.local-s3),
  # trains the three quantile models and writes them to models/<version>/.
  PT_LOCAL=1 python training/sagemaker_job.py
  # Managed SageMaker script-mode job (needs `pip install sagemaker` + a role ARN):
  python training/sagemaker_job.py --sagemaker --role <execution-role-arn> --bucket <bucket>
"""
from __future__ import annotations

import argparse
import os
import sys


def run_local() -> int:
    """Run the training script in-process (the simplest path; model goes to models/)."""
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, "..", "engine"), os.path.join(here, "..", "contracts", "python")):
        p = os.path.abspath(p)
        if p not in sys.path:
            sys.path.insert(0, p)
    sys.path.insert(0, here)  # so `import train` works
    import train

    train.main()
    return 0


def run_sagemaker(role: str, bucket: str, instance: str = "ml.m5.xlarge") -> int:
    """Launch train.py as a SageMaker script-mode job (brief §10.4)."""
    import sagemaker
    from sagemaker.sklearn.estimator import SKLearn

    sess = sagemaker.Session()
    region = sess.boto_region_name
    est = SKLearn(
        entry_point="train.py",
        source_dir=os.path.dirname(os.path.abspath(__file__)),
        role=role,
        instance_type=instance,
        instance_count=1,
        framework_version="1.2-1",
        py_version="py3",
        base_job_name="plumetrace-lgbm",
        environment={
            "PT_BUCKET": bucket,
            "AWS_REGION": region,
        },
        dependencies=[os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "engine", "plumetrace_engine"))],
    )
    # train.py reads/writes via s3io (features/ in, models/ out) using PT_BUCKET.
    est.fit(wait=True)
    print("SageMaker training job complete.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Train the PlumeTrace LightGBM quantile models.")
    ap.add_argument("--sagemaker", action="store_true", help="launch a managed SageMaker job instead of training locally")
    ap.add_argument("--role", help="SageMaker execution role ARN (required with --sagemaker)")
    ap.add_argument("--bucket", help="S3 bucket for features in / models out (required with --sagemaker)")
    ap.add_argument("--instance", default="ml.m5.xlarge")
    args = ap.parse_args(argv)

    if args.sagemaker:
        if not args.role or not args.bucket:
            ap.error("--sagemaker requires --role and --bucket")
        return run_sagemaker(args.role, args.bucket, args.instance)
    return run_local()


if __name__ == "__main__":
    raise SystemExit(main())
