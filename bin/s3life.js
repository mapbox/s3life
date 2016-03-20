#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2), {
  boolean: ['h', 'help', 'j', 'json']
});

var s3life = require('..');

function help(code) {
  console.log('USAGE: s3life <command> <bucket> OPTIONS');
  console.log('');
  console.log('Available commands:');
  console.log('  read');
  console.log('  put-rule');
  console.log('  remove-rule');
  console.log('');
  console.log('Available Options:');
  console.log('  -j, --json    display Lifecycle Configuration in JSON format');
  process.exit(code || 0);
}

function error(err) {
  console.error(err);
  process.exit(1);
}

if (args.h || args.help) return help();
var asJson = args.j || args.json;
var command = args._[0];
var bucket = args._[1];
var rule = args._[2];

if (!command || !bucket) return help(1);

var commands = ['read', 'put-rule', 'remove-rule'];
if (commands.indexOf(command) === -1) return help(1);

if (command === 'read') {
  return s3life.readPolicy(bucket, function(err, policy) {
    if (err) return error(err);
    if (asJson) return console.log(JSON.stringify(policy, null, 2));
    policy.Rules.forEach(function(rule) {
      console.log(s3life.ruleToString(rule));
    });
  });
}

if (command === 'put-rule') {
  if (!rule) return help(1);

  try { rule = JSON.parse(rule); }
  catch (err) {
    try { rule = s3life.ruleFromString(rule); }
    catch (err) { return error(err); }
  }

  return s3life.putRule(bucket, rule, function(err) {
    if (err) return error(err);
  });
}

if (command === 'remove-rule') {
  if (!rule) return help(1);

  var id;
  try { id = JSON.parse(rule).ID; }
  catch (err) {
    try { id = s3life.ruleFromString(rule).ID; }
    catch(err) { id = rule; }
  }

  return s3life.removeRule(bucket, id, function(err) {
    if (err) return error(err);
  });
}
