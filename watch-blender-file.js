var chokidar = require('chokidar')
var cp = require('child_process')
var cuid = require('cuid')
var fs = require('fs')

var connectedClients = {}

chokidar.watch('./*.blend', {})
.on('change', function (blenderFilePath) {
  var modelName = blenderFilePath.split('.blend')[0]
  var wavefrontPath = modelName + '.obj'
  var jsonPath = modelName + '.json'

  cp.exec(
    `/Applications/blender.app/Contents/MacOS/blender ${blenderFilePath} --background --python blender-to-obj.py -- ${wavefrontPath}`,
    function (err, stdout, stderr) {
      if (err) {
        return console.error(`exec error: ${err}`)
      }
      console.log(`stdout: ${stdout}`)
      console.log(`stderr: ${stderr}`)

      cp.exec(
        `cat ${wavefrontPath} | node ./node_modules/wavefront-obj-parser/bin/obj2json.js > ${jsonPath}`,
        function (err, stdout, stderr) {
          if (err) { throw err }

          fs.readFile(jsonPath, function (err, jsonModelFile) {
            if (err) { throw err }

            for (var clientId in connectedClients) {
              if (connectedClients[clientId].readyState === WebSocket.OPEN) {
                connectedClients[clientId].send(
                  jsonModelFile.toString()
                )
              } else {
                console.log(`Client not ready? ${connectedClients[clientId].readyState}`)
              }
            }
          })
        }
      )
    }
  )
})

var WebSocket = require('ws')
var wsServer = new WebSocket.Server({port: 8989})

wsServer.on('connection', function (ws) {
  ws.clientId = cuid()
  connectedClients[ws.clientId] = ws

  ws.on('close', function () {
    delete connectedClients[ws.clientId]
  })
})
