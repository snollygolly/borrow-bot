module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  shipit.initConfig({
    default: {
      workspace: './tmp',
      deployTo: '~/borrow-bot-test',
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
};
