const express = require('express')
const bodyParser = require('body-parser')
const {v4: uuidv4} = require('uuid')
const multer = require('multer')
const cors = require('cors')
const storage = multer.memoryStorage()
const upload = multer({storage: storage})
const winston = require('winston')

const isProduction = () => process.env.NODE_ENV === 'production'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'}),
  ],
})

const app = express()
const port = 9000

const level = require('level')
const ttl = require('level-ttl')

const db = ttl(level('./db', {valueEncoding: 'binary'}))

if (!isProduction()) {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }))

  app.use(cors())
} else {
  app.use(express.static('build'))
  app.use('/static', express.static('build'))
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/images/:imageId', (req, res, next) => {
  db.get(req.params.imageId, (err, value) => {
    if (err) return next(err)

    res.writeHead(200, {'Content-Type': 'image/jpeg'})
    res.end(value, 'binary')
  })
})

app.get('/images/:imageId/preview', (req, res, next) => {
  res.send(`<img src='/images/${req.params.imageId}'></img>`)
})

app.post('/images', upload.single('uploaded_file'), (req, res, next) => {

  const {
          buffer,
          mimeType: imageType,
          originalname: fileName,
          size: fileSize
        } = req?.file || {}

  const ttl = req.body?.ttl * 1000

  logger.info('File meta data:',
    {imageType, fileName, fileSize, ttl}
  )

  const id = uuidv4()

  db.put(id, buffer, {ttl}, err => {
    if (err) return next(err)

    logger.info(fileName + ' inserted to db successfully')

    const fileUrl = `http://${req.headers.host}${req.url}/${id}`

    res.json(fileUrl)
  })
})

app.use(function (request, response, next) {
  response.header('Access-Control-Allow-Origin', '*')
  response.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})

app.listen(port, () => {
  logger.info(`The service is listening at http://localhost:${port}`)
})