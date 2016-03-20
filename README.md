# s3life

Helper for managing S3 lifecycle policies.

## CLI Usage

### s3life read \<bucket\> [-j | --json]

Read the Lifecycle Configuration for the specified bucket. The `--json` flag
prints the configuration as JSON. Default behavior is to print rules as simple
strings.

### s3life put-rule \<bucket\> \<rule\>

Add or overwrite a rule in a bucket. If no ID is specified, a new rule will always
be added. Specify an ID as part of the rule in order to update an existing rule.

### s3life remove-rule \<bucket\> \<ruleid\>

Remove a rule from a bucket by specifying its ID.

### Rules as strings

The CLI tool allows you to read and specify Lifecycle Configuration rules as
strings. The format of the string indicates the rule's details.

Multipart Upload Expiration:

```
# expire multipart uploads older than 7 days bucket-wide
mpu * 7d
```

Object & Version Expiration:

```
# expire objects under `temp/` after 1 day
expire temp/ 1d

# expire objects under `temp/` on March 20th, 2016
expire temp/ 1458432000000

# expire non-current versions under `temp/` after 1 day
expire version temp/ 1d
```

Storage transitions:

```
# move objects to infrequent-access after 30 days
transition * ia 30d

# move objects to glacier after 2 days
transition * glacier 2d

# move non-current versions to glacier after 1 day
transition version * glacier 1d
```

Complex rules. All actions must share the same prefix:

```
# specify multiple transitions in one rule
transition * ia 30d, transition * glacier 60d

# transitions and expiration
transition * ia 30d, transition * glacier 60d, expire 100d
```

Rule with an ID specified:

```
# ID `abc`
abc: expire * 1d
```

## Testing

Running tests requires authentication. Environment must be configured for access
to interact with Lifecycle Configuration on Mapbox buckets.
