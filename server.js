const express = require('express')
const next = require('next')
const { join } = require('path')

const port = parseInt(process.env.PORT, 10) || 3000
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = express()

  server.use(join(process.env.BASE_PATH.startsWith('/') ? process.env.BASE_PATH : "/".concat(process.env.BASE_PATH), process.env.UPLOAD_FOLD.replace("/", "")), express.static(join(__dirname, process.env.UPLOAD_FOLD.replace("/", "")), { redirect: false }))

  server.all("*", (req, res) => handle(req, res))

  server.listen(port, err => {
    if (err) throw err
    process.stdout.write(`> Ready on http://localhost:${port}`)
  })
}).catch(err => {
  console.log(err?.stack)

  process.exit(1)
})


