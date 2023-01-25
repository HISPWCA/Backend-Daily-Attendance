module.exports = {
  reactStrictMode: true,
  distDir: '_next',
  basePath: process.env.BASE_PATH,
  generateBuildId: async () => {
    if (process.env.BUILD_ID) {
      return process.env.BUILD_ID
    } else {
      return `${new Date().getTime()}`
    }
  },
  
}