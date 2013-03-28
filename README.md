s3life
------

Helper for managing S3 lifecycle policies.

    Usage:
      s3life <bucket> ls
      s3life <bucket> add <prefix> [expire|glacier] <days>
      s3life <bucket> rm <prefix>
      s3life <bucket> del

    s3life <bucket> ls

      List all rules in a bucket's lifecycle policy.

    s3life <bucket> add <prefix> [expire|glacier] <days>

      Add a one or more rules to a lifecycle policy. Use {hex} or {dec} to
      specify a templating token to generate multiple rules using character
      ranges (0-f or 0-9).

    s3life <bucket> rm <prefix>

      Remove a single rule from a lifecycle policy.

    s3life <bucket> del

      Remove entire lifecycle policy.

