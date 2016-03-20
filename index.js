var AWS = require('aws-sdk');
var util = require('util');
var crypto = require('crypto');

/**
 * Module providing functions for interacting with S3 Lifecycle Configuration
 *
 * @name s3life
 */
module.exports = {
  removePolicy: removePolicy,
  readPolicy: readPolicy,
  putPolicy: putPolicy,
  putRule: putRule,
  removeRule: removeRule,
  ruleFromString: ruleFromString,
  ruleToString: ruleToString
};

/**
 * Create an ID for a Lifecycle rule
 *
 * @private
 * @param {object|string} rule - as an object or a string
 * @returns {string} a unique ID for the rule
 */
function idForRule(rule) {
  if (typeof rule === 'object')  {
    if (rule.ID) return rule.ID;
    rule = ruleToString(rule);
  }

  return crypto.createHash('md5').update(rule).digest('hex');
}

/**
 * Given a bucket's name, get an S3 client for the correct region
 *
 * @private
 * @param {string} bucket - the bucket's name
 * @param {function} callback - a function that will be handed an S3 client
 */
function getClient(bucket, callback) {
  var s3 = new AWS.S3({ signatureVersion: 'v4' });

  s3.getBucketLocation({ Bucket: bucket }, function(err, data) {
    if (err) return callback(err);

    var region = data.LocationConstraint === '' ?
      undefined : data.LocationConstraint === 'EU' ?
      'eu-west-1' : data.LocationConstraint;

    return callback(null, new AWS.S3({ region: region }));
  });
}

/**
 * Remove all Lifecycle Configuration from a bucket
 *
 * @param {string} bucket - the bucket's name
 * @param {object} [s3] - an S3 client
 * @param {function} callback - a function that will be called when the Lifecycle
 * Configuration has been removed
 */
function removePolicy(bucket, s3, callback) {
  if (typeof s3 === 'function') {
    callback = s3;
    getClient(bucket, gotClient);
  }
  else gotClient(null, s3);

  function gotClient(err, s3) {
    if (err) return callback(err);
    s3.deleteBucketLifecycle({ Bucket: bucket}, callback);
  }
}

/**
 * Read the Lifecycle Configuration of an S3 bucket
 *
 * @param {string} bucket - the bucket's name
 * @param {object} [s3] - an S3 client
 * @param {function} callback - a function that will be handed the Lifecycle
 * Configuration object
 */
function readPolicy(bucket, s3, callback) {
  if (typeof s3 === 'function') {
    callback = s3;
    getClient(bucket, gotClient);
  }
  else gotClient(null, s3);

  function gotClient(err, s3) {
    if (err) return callback(err);
    s3.getBucketLifecycleConfiguration({ Bucket: bucket }, function(err, data) {
      if (err && err.code === 'NoSuchLifecycleConfiguration') return callback();
      callback(err, data);
    });
  }
}

/**
 * Add or replace the Lifecycle Configuration on an S3 bucket.
 *
 * @param {string} bucket - the bucket's name
 * @param {object} policy - the desired Lifecycle Configuration
 * @param {object} [s3] - an S3 client
 * @param {function} callback - a function that will be callled when the Lifecycle
 * Configuration has been updated
 */
function putPolicy(bucket, policy, s3, callback) {
  if (typeof s3 === 'function') {
    callback = s3;
    getClient(bucket, gotClient);
  }
  else gotClient(null, s3);

  function gotClient(err, s3) {
    if (err) return callback(err);
    s3.putBucketLifecycleConfiguration({ Bucket: bucket, LifecycleConfiguration: policy }, callback);
  }
}

/**
 * Add or update a rule in a bucket's Lifecycle Configuration
 *
 * @param {string} bucket - the bucket's name
 * @param {object} rule - a Lifecycle Configuration rule
 * @param {object} [s3] - an S3 client
 * @param {function} callback - a function that will be callled when the Lifecycle
 * Configuration has been updated
 */
function putRule(bucket, rule, s3, callback) {
  if (typeof s3 === 'function') {
    callback = s3;
    getClient(bucket, gotClient);
  }
  else gotClient(null, s3);

  function gotClient(err, s3) {
    if (err) return callback(err);
    readPolicy(bucket, s3, function(err, policy) {
      if (err) return callback(err);
      gotPolicy(s3, policy);
    });
  }

  function gotPolicy(s3, policy) {
    policy = policy || { Rules: [] };

    var replaced = false;
    policy.Rules = policy.Rules.map(function(existingRule) {
      if (existingRule.ID === rule.ID) {
        replaced = true;
        return rule;
      } else if (existingRule.Prefix === rule.Prefix) {
        if (rule.AbortIncompleteMultipartUpload) existingRule.AbortIncompleteMultipartUpload = rule.AbortIncompleteMultipartUpload;
        if (rule.Expiration) existingRule.Expiration = rule.Expiration;
        if (rule.NoncurrentVersionExpiration) existingRule.NoncurrentVersionExpiration = rule.NoncurrentVersionExpiration;
        if (rule.Transitions) rule.Transitions.forEach(function(transition) {
          existingRule.Transitions.push(transition);
        });
        if (rule.NoncurrentVersionTransitions) rule.NoncurrentVersionTransitions.forEach(function(transition) {
          existingRule.NoncurrentVersionTransitions.push(transition);
        });
        replaced = true;
        return existingRule;
      } else {
        return existingRule;
      }
    });

    if (!replaced) policy.Rules.push(rule);

    s3.putBucketLifecycleConfiguration({
      Bucket: bucket,
      LifecycleConfiguration: policy
    }, callback);
  }
}

/**
 * Remove a rule from a bucket's Lifecycle Configuration
 *
 * @param {string} bucket - the bucket's name
 * @param {object} ruleID - the rule's ID
 * @param {object} [s3] - an S3 client
 * @param {function} callback - a function that will be callled when the Lifecycle
 * Configuration has been updated
 */
function removeRule(bucket, ruleId, s3, callback) {
  if (typeof s3 === 'function') {
    callback = s3;
    getClient(bucket, gotClient);
  }
  else gotClient(null, s3);

  function gotClient(err, s3) {
    if (err) return callback(err);
    readPolicy(bucket, s3, function(err, policy) {
      if (err) return callback(err);
      gotPolicy(s3, policy);
    });
  }

  function gotPolicy(s3, policy) {
    policy = policy || { Rules: [] };

    policy.Rules = policy.Rules.reduce(function(newRules, existingRule) {
      if (existingRule.ID === ruleId) return newRules;
      newRules.push(existingRule);
      return newRules;
    }, []);

    s3.putBucketLifecycleConfiguration({
      Bucket: bucket,
      LifecycleConfiguration: policy
    }, callback);
  }
}

/**
 * Convert a string into a Lifecycle Configuration Rule object
 *
 * @param {string} str - a single rule represented as a string
 * @returns {object} the rule as an object
 */
function ruleFromString(str) {
  var mpu = /^mpu (.*) (\d*)d$/;
  var expire = /^expire (version )?(.*) (\d+)(d)?$/;
  var transition = /^transition (version )?(.*) (glacier|ia) (\d*)(d)?$/;

  var id = str.split(': ').length === 2 ? str.split(': ')[0] : idForRule(str);
  str = str.split(': ').length === 2 ? str.split(': ')[1] : str;

  var prefix;

  var rule = str.split(', ').reduce(function(rule, effect) {
    var match = effect.match(mpu);
    if (match) {
      if (!prefix) prefix = match[1];
      if (prefix && prefix !== match[1])
        throw new Error('Invalid rule string: all effects must share the same prefix');

      rule.AbortIncompleteMultipartUpload = {
        DaysAfterInitiation: Number(match[2])
      };
    }

    match = effect.match(expire);
    if (match) {
      if (!prefix) prefix = match[2];
      if (prefix && prefix !== match[2])
        throw new Error('Invalid rule string: all effects must share the same prefix');

      if (match[1])
        rule.NoncurrentVersionExpiration = match[4] ? { NoncurrentDays: Number(match[3]) } : { Date: Number(match[3]) };
      else
        rule.Expiration = match[4] ? { Days: Number(match[3]) } : { Date: Number(match[3]) };
    }

    match = effect.match(transition);
    if (match) {
      if (!prefix) prefix = match[2];
      if (prefix && prefix !== match[2])
        throw new Error('Invalid rule string: all effects must share the same prefix');

      var storage = match[3] === 'ia' ? 'STANDARD_IA' : 'GLACIER';

      if (match[1]) {
        if (!match[5]) throw new Error('Noncurrent version transitions must specify days');
        rule.NoncurrentVersionTransitions = rule.NoncurrentVersionTransitions || [];
        rule.NoncurrentVersionTransitions.push({
          NoncurrentDays: Number(match[4]),
          StorageClass: storage
        });
      } else {
        rule.Transitions = rule.Transitions || [];
        rule.Transitions.push(match[5] ?
          { Days: Number(match[4]), StorageClass: storage } :
          { Date: Number(match[4]), StorageClass: storage });
      }
    }

    return rule;
  }, {
    ID: id,
    Status: 'Enabled'
  });

  if (!prefix) throw new Error('Could not parse rule string');
  rule.Prefix = prefix === '*' ? '' : prefix;
  return rule;
}

/**
 * Convert a Lifecycle Configuration Rule object into a string
 *
 * @param {object} rule - a rule represented as an object
 * @returns {string} the rule represented as a string
 */
function ruleToString(rule) {
  var effects = [];

  if (rule.AbortIncompleteMultipartUpload)
    effects.push(util.format(
      'mpu %s %sd',
      rule.Prefix || '*',
      rule.AbortIncompleteMultipartUpload.DaysAfterInitiation
    ));

  if (rule.Expiration)
    effects.push(util.format(
      'expire %s %s',
      rule.Prefix || '*',
      rule.Expiration.Days || +new Date(rule.Expiration.Date)
    ) + (rule.Expiration.Days ? 'd' : ''));

  if (rule.NoncurrentVersionExpiration && !rule.NoncurrentVersionExpiration.NoncurrentDays)
    throw new Error('Noncurrent version transitions must specify days');

  if (rule.NoncurrentVersionExpiration)
    effects.push(util.format(
      'expire version %s %s',
      rule.Prefix || '*',
      rule.NoncurrentVersionExpiration.NoncurrentDays + 'd'
    ));

  if (rule.Transitions) {
    rule.Transitions.forEach(function(transition) {
      effects.push(util.format(
        'transition %s %s %s',
        rule.Prefix || '*',
        transition.StorageClass === 'GLACIER' ? 'glacier' : 'ia',
        transition.Days || +new Date(transition.Date)
      ) + (transition.Days ? 'd' : ''));
    });
  }

  if (rule.NoncurrentVersionTransitions) {
    rule.NoncurrentVersionTransitions.forEach(function(transition) {
      if (!transition.NoncurrentDays)
        throw new Error('Noncurrent version transitions must specify days');

      effects.push(util.format(
        'transition version %s %s %s',
        rule.Prefix || '*',
        transition.StorageClass === 'GLACIER' ? 'glacier' : 'ia',
        transition.NoncurrentDays + 'd'
      ));
    });
  }

  return (rule.ID ? rule.ID : idForRule(effects.join(', '))) + ': ' + effects.join(', ');
}
