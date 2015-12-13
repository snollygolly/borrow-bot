module.exports = function (shipit) {
  require('shipit-deploy')(shipit);
  require('shipit-shared')(shipit);
  var config = require('./config.json');

  var deployPath = '~/borrow-bot';

  shipit.initConfig({
    default: {
      workspace: './tmp',
      deployTo: deployPath,
      repositoryUrl: 'https://github.com/snollygolly/borrow-bot.git',
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: '~/.ssh/id_rsa',
      shallowClone: true
    },
    production: {
      servers: config.deploy.username + '@' config.deploy.hostname
    }
  });

  shipit.task('install', function () {
    return shipit.remote("bash " + deployPath + '/current/install ' + deployPath + "/current/");
  });

  shipit.on('published', function () {
    shipit.start('install');
  });
};
