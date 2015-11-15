module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  var deployPath = '~/borrow-bot-test';

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
      servers: 'matthorning@borrowbot.net'
    }
  });

  shipit.task('install', function () {
    return shipit.remote("bash " + deployPath + '/current/install');
  });

  shipit.on('published', function () {
    shipit.start('install');
  });
};
