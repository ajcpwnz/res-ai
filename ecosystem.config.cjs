module.exports = {
  apps: [
    {
      name: "res-ai",
      cwd: "/root/res-ai",
      script: "bun",
      args: "run dev",
      watch: false,
      env_production: {
        NODE_ENV: "production"
      }
    }
  ],

  deploy: {
    dev: {
      user: "root",
      host: "67.205.183.132",
      ref: "origin/master",
      repo: "git@github.com:ajcpwnz/res-ai.git",
      path: "/root/res-ai",
      keep_releases: 0,
      "post-deploy": "/bin/bun install && pm2 start ecosystem.config.cjs"
    }
  }
};
