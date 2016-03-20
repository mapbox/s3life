var test = require('tape');
var d3 = require('d3-queue');
var s3life = require('..');

test('[ruleToString]', function(assert) {
  var rule = {
    Prefix: 'test/',
    AbortIncompleteMultipartUpload: {
      DaysAfterInitiation: 1
    }
  };
  assert.equal(s3life.ruleToString(rule), 'ebf39048aa22422f4027e8cb15d4809b: mpu test/ 1d', 'individual mpu rule, no id');
  rule.ID = 'test';
  assert.equal(s3life.ruleToString(rule), 'test: mpu test/ 1d', 'individual mpu rule, existing id');

  rule = {
    ID: 'test',
    Prefix: 'test/',
    Expiration: {
      Days: 1
    }
  };
  assert.equal(s3life.ruleToString(rule), 'test: expire test/ 1d', 'individual expiration rule, days');
  rule.Expiration.Date = +new Date('2016-03-20');
  delete rule.Expiration.Days;
  assert.equal(s3life.ruleToString(rule), 'test: expire test/ 1458432000000', 'individual expiration rule, date');

  rule = {
    ID: 'test',
    Prefix: 'test/',
    NoncurrentVersionExpiration: {
      NoncurrentDays: 1
    }
  };
  assert.equal(s3life.ruleToString(rule), 'test: expire version test/ 1d', 'individual version expiration rule, days');
  rule.NoncurrentVersionExpiration.Date = +new Date('2016-03-20');
  delete rule.NoncurrentVersionExpiration.NoncurrentDays;
  assert.throws(
    function() { s3life.ruleToString(rule); },
    /Noncurrent version transitions must specify days/,
    'cannot specify date for version expiration'
  );

  rule = {
    ID: 'test',
    Prefix: 'test/',
    Transitions: [
      { Days: 1, StorageClass: 'GLACIER' }
    ]
  };
  assert.equal(s3life.ruleToString(rule), 'test: transition test/ glacier 1d', 'individual transition rule, days, glacier');
  rule.Transitions[0].StorageClass = 'STANDARD_IA';
  assert.equal(s3life.ruleToString(rule), 'test: transition test/ ia 1d', 'individual transition rule, days, ia');
  rule.Transitions[0].Date = +new Date('2016-03-20');
  delete rule.Transitions[0].Days;
  assert.equal(s3life.ruleToString(rule), 'test: transition test/ ia 1458432000000', 'individual transition rule, date, ia');
  rule.Transitions = [
    { Days: 1, StorageClass: 'STANDARD_IA'},
    { Days: 2, StorageClass: 'GLACIER'}
  ];

  assert.equal(
    s3life.ruleToString(rule),
    'test: transition test/ ia 1d, transition test/ glacier 2d',
    'multiple transition rules'
  );
  rule = {
    ID: 'test',
    Prefix: 'test/',
    NoncurrentVersionTransitions: [
      { NoncurrentDays: 1, StorageClass: 'GLACIER' }
    ]
  };
  assert.equal(s3life.ruleToString(rule), 'test: transition version test/ glacier 1d', 'individual version transition rule, days, glacier');
  rule.NoncurrentVersionTransitions[0].StorageClass = 'STANDARD_IA';
  assert.equal(s3life.ruleToString(rule), 'test: transition version test/ ia 1d', 'individual version transition rule, days, ia');
  rule.NoncurrentVersionTransitions[0].Date = +new Date('2016-03-20');
  delete rule.NoncurrentVersionTransitions[0].NoncurrentDays;
  assert.throws(
    function() { s3life.ruleToString(rule); },
    /Noncurrent version transitions must specify days/,
    'cannot specify date for version transitions'
  );
  rule.NoncurrentVersionTransitions = [
    { NoncurrentDays: 1, StorageClass: 'STANDARD_IA'},
    { NoncurrentDays: 2, StorageClass: 'GLACIER'}
  ];
  assert.equal(
    s3life.ruleToString(rule),
    'test: transition version test/ ia 1d, transition version test/ glacier 2d',
    'multiple version transition rules'
  );

  rule = {
    ID: 'test',
    Prefix: 'test/',
    AbortIncompleteMultipartUpload: {
      DaysAfterInitiation: 1
    },
    Expiration: { Days: 3 },
    Transitions: [
      { Days: 1, StorageClass: 'STANDARD_IA'},
      { Days: 2, StorageClass: 'GLACIER'}
    ]
  };
  assert.equal(
    s3life.ruleToString(rule),
    'test: mpu test/ 1d, expire test/ 3d, transition test/ ia 1d, transition test/ glacier 2d',
    'several effects'
  );

  rule = {
    ID: 'test',
    Prefix: '',
    Expiration: { Days: 1 }
  };
  assert.equal(s3life.ruleToString(rule), 'test: expire * 1d');

  assert.end();
});

test('[ruleFromString]', function(assert) {
  assert.deepEqual(
    s3life.ruleFromString('ebf39048aa22422f4027e8cb15d4809b: mpu test/ 1d'),
    {
      ID: 'ebf39048aa22422f4027e8cb15d4809b',
      Prefix: 'test/',
      AbortIncompleteMultipartUpload: {
        DaysAfterInitiation: 1
      },
      Status: 'Enabled'
    }, 'individual mpu rule');

  assert.deepEqual(
    s3life.ruleFromString('test: expire test/ 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      Expiration: { Days: 1 },
      Status: 'Enabled'
    }, 'individual expiration rule, days');

  assert.deepEqual(
    s3life.ruleFromString('test: expire test/ 1458432000000'),
    {
      ID: 'test',
      Prefix: 'test/',
      Expiration: { Date: +new Date('2016-03-20') },
      Status: 'Enabled'
    }, 'individual expiration rule, date');

  assert.deepEqual(
    s3life.ruleFromString('test: expire version test/ 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      NoncurrentVersionExpiration: { NoncurrentDays: 1 },
      Status: 'Enabled'
    }, 'individual version expiration rule, days');

  assert.deepEqual(
    s3life.ruleFromString('test: expire version test/ 1458432000000'),
    {
      ID: 'test',
      Prefix: 'test/',
      NoncurrentVersionExpiration: { Date: +new Date('2016-03-20') },
      Status: 'Enabled'
    }, 'individual version expiration rule, date');

  assert.deepEqual(
    s3life.ruleFromString('test: transition test/ glacier 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      Transitions: [
        { Days: 1, StorageClass: 'GLACIER' }
      ],
      Status: 'Enabled'
    }, 'individual transition rule, days, glacier');

  assert.deepEqual(
    s3life.ruleFromString('test: transition test/ ia 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      Transitions: [
        { Days: 1, StorageClass: 'STANDARD_IA' }
      ],
      Status: 'Enabled'
    }, 'individual transition rule, days, ia');

  assert.deepEqual(
    s3life.ruleFromString('test: transition test/ ia 1458432000000'),
    {
      ID: 'test',
      Prefix: 'test/',
      Transitions: [
        { Date: +new Date('2016-03-20'), StorageClass: 'STANDARD_IA' }
      ],
      Status: 'Enabled'
    }, 'individual transition rule, date, ia');

  assert.deepEqual(
    s3life.ruleFromString('test: transition version test/ glacier 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      NoncurrentVersionTransitions: [
        { NoncurrentDays: 1, StorageClass: 'GLACIER' }
      ],
      Status: 'Enabled'
    }, 'individual version transition rule, days, glacier');

  assert.deepEqual(
    s3life.ruleFromString('test: transition version test/ ia 1d'),
    {
      ID: 'test',
      Prefix: 'test/',
      NoncurrentVersionTransitions: [
        { NoncurrentDays: 1, StorageClass: 'STANDARD_IA' }
      ],
      Status: 'Enabled'
    }, 'individual version transition rule, days, ia');

  assert.throws(
    function() { s3life.ruleFromString('test: transition version test/ ia 1458432000000'); },
    /Noncurrent version transitions must specify days/,
    'cannot specify date for version transitions'
  );

  assert.deepEqual(
    s3life.ruleFromString('test: transition version test/ ia 1d, transition version test/ glacier 2d'),
    {
      ID: 'test',
      Prefix: 'test/',
      NoncurrentVersionTransitions: [
        { NoncurrentDays: 1, StorageClass: 'STANDARD_IA'},
        { NoncurrentDays: 2, StorageClass: 'GLACIER'}
      ],
      Status: 'Enabled'
    }, 'multiple version transition rules'
  );

  assert.deepEqual(
    s3life.ruleFromString('test: mpu test/ 1d, expire test/ 3d, transition test/ ia 1d, transition test/ glacier 2d'),
    {
      ID: 'test',
      Prefix: 'test/',
      AbortIncompleteMultipartUpload: {
        DaysAfterInitiation: 1
      },
      Expiration: { Days: 3 },
      Transitions: [
        { Days: 1, StorageClass: 'STANDARD_IA'},
        { Days: 2, StorageClass: 'GLACIER'}
      ],
      Status: 'Enabled'
    }, 'several effects'
  );

  assert.deepEqual(
    s3life.ruleFromString('expire * 1d'),
    {
      ID: 'fe7d820179ced32ed270d70549a974e0',
      Prefix: '',
      Expiration: { Days: 1 },
      Status: 'Enabled'
    },
    'creates ID, understands prefix *'
  );

  assert.end();
});

test('[getClient] commands work in all regions', function(assert) {
  var regions = [
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'sa-east-1',
    'ap-northeast-1',
    'ap-southeast-1',
    'ap-southeast-2'
  ];

  var queue = d3.queue(10);
  regions.forEach(function(region) {
    queue.defer(function(next) {
      s3life.readPolicy('mapbox-' + region, function(err) {
        assert.ifError(err, 'successfully read policy in ' + region);
        next();
      });
    });
  });
  queue.awaitAll(function() {
    assert.end();
  });
});

test('[single bucket] consecutive testing', function(t) {
  var testBucket = 'goobtest';

  t.test('[removePolicy] remove any existing policy from the bucket', function(assert) {
    s3life.removePolicy(testBucket, function(err) {
      assert.ifError(err, 'success');
      assert.end();
    });
  });

  t.test('[readPolicy] when policy does not exist', function(assert) {
    setTimeout(function() {
      s3life.readPolicy(testBucket, function(err, policy) {
        assert.ifError(err, 'success');
        assert.notOk(policy, 'no policy returned');
        assert.end();
      });
    }, 2000);
  });

  t.test('[putPolicy] writes new policy', function(assert) {
    s3life.putPolicy(testBucket, {
      Rules: [
        {
          ID: 'first-test',
          Prefix: 'test/',
          Status: 'Enabled',
          Expiration: { Days: 1 }
        }
      ]
    }, function(err) {
      assert.ifError(err, 'success');
      assert.end();
    });
  });

  t.test('[readPolicy] when policy exists', function(assert) {
    setTimeout(function() {
      s3life.readPolicy(testBucket, function(err, policy) {
        assert.ifError(err, 'success');
        assert.deepEqual(policy, {
          Rules: [
            {
              ID: 'first-test',
              Prefix: 'test/',
              Status: 'Enabled',
              Expiration: { Days: 1 },
              NoncurrentVersionTransitions: [],
              Transitions: []
            }
          ]
        }, 'read expected policy');
        assert.end();
      });
    }, 2000);
  });

  t.test('[putPolicy] replaces existing policy', function(assert) {
    s3life.putPolicy(testBucket, {
      Rules: [
        {
          ID: 'second-test',
          Prefix: 'test2/',
          Status: 'Enabled',
          Expiration: { Days: 2 }
        }
      ]
    }, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[putRule] adds to existing policy', function(assert) {
    s3life.putRule(testBucket, {
      ID: 'third-rule',
      Prefix: 'test3/',
      Status: 'Enabled',
      Expiration: { Days: 3 }
    }, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test3/',
                Status: 'Enabled',
                Expiration: { Days: 3 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[putRule] replaces existing rule', function(assert) {
    s3life.putRule(testBucket, {
      ID: 'third-rule',
      Prefix: 'test4/',
      Status: 'Enabled',
      Expiration: { Days: 4 }
    }, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test4/',
                Status: 'Enabled',
                Expiration: { Days: 4 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[putRule] second rule with the same prefix', function(assert) {
    s3life.putRule(testBucket, {
      ID: 'fifth-rule',
      Prefix: 'test5/',
      Status: 'Enabled',
      Expiration: { Days: 5 }
    }, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test4/',
                Status: 'Enabled',
                Expiration: { Days: 4 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'fifth-rule',
                Prefix: 'test5/',
                Status: 'Enabled',
                Expiration: { Days: 5 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[putRule] complex rule', function(assert) {
    s3life.putRule(testBucket, {
      ID: 'fifth-rule',
      Prefix: 'test5/',
      Status: 'Enabled',
      Expiration: { Days: 100 },
      NoncurrentVersionTransitions: [],
      Transitions: [
        { Days: 30, StorageClass: 'STANDARD_IA' },
        { Days: 62, StorageClass: 'GLACIER' }
      ]
    }, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test4/',
                Status: 'Enabled',
                Expiration: { Days: 4 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'fifth-rule',
                Prefix: 'test5/',
                Status: 'Enabled',
                Expiration: { Days: 100 },
                NoncurrentVersionTransitions: [],
                Transitions: [
                  { Days: 30, StorageClass: 'STANDARD_IA' },
                  { Days: 62, StorageClass: 'GLACIER' }
                ]
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[removeRule] removes existing rule', function(assert) {
    s3life.removeRule(testBucket, 'fifth-rule', function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test4/',
                Status: 'Enabled',
                Expiration: { Days: 4 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[removeRule] no-op on non-existent rule', function(assert) {
    s3life.removeRule(testBucket, 'sixth-rule', function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after put');
          assert.deepEqual(policy, {
            Rules: [
              {
                ID: 'second-test',
                Prefix: 'test2/',
                Status: 'Enabled',
                Expiration: { Days: 2 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              },
              {
                ID: 'third-rule',
                Prefix: 'test4/',
                Status: 'Enabled',
                Expiration: { Days: 4 },
                NoncurrentVersionTransitions: [],
                Transitions: []
              }
            ]
          }, 'read expected policy');
          assert.end();
        });
      }, 2000);
    });
  });

  t.test('[removePolicy] removes policy entirely', function(assert) {
    s3life.removePolicy(testBucket, function(err) {
      assert.ifError(err, 'success');
      setTimeout(function() {
        s3life.readPolicy(testBucket, function(err, policy) {
          assert.notOk(err, 'checked after removal');
          assert.notOk(policy, 'policy was removed');
          assert.end();
        });
      }, 2000);
    });
  });

  t.end();
});
