module.exports = {
  apps: [
    {
      name: "res-ai",
      cwd: "/root/res‑ai/current",
      script: "bun",
      args: "run dev",
      watch: false,
      env_production: {
        NODE_ENV: "production"
      }
    }
  ],

  deploy: {
    production: {
      user: "root",
      host: "67.205.183.132",
      ref: "origin/master",
      repo: "git@github.com:ajcpwnz/res-ai.git",
      path: "/root/res‑ai",
      keep_releases: 3,

      "post-deploy": `
        cd /root/res‑ai/current &&
        bun install &&
        pm2 reload ecosystem.config.js --env production
      `
    }
  }
};
