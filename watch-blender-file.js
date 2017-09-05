var chokidar = require('chokidar')
var cp = require('child_process')
var cuid = require('cuid')
var fs = require('fs')

// Keep track of connected clients so that we can send the vertex data to every connected browser tab
var connectedClients = {}

// Watch our blend file for changes
chokidar.watch('./*.blend', {})
.on('change', function (blenderFilePath) {
  var modelName = blenderFilePath.split('.blend')[0]
  var wavefrontPath = modelName + '.obj'
  var jsonPath = modelName + '.json'

  var pathToBlenderExecutable = '/Applications/blender.app/Contents/MacOS/blender'
  // Use the blender CLI to export our .blend model as OBJ
  cp.exec(
    `${pathToBlenderExecutable} ${blenderFilePath} --background --python blender-to-obj.py -- ${wavefrontPath}`,
    function (err, stdout, stderr) {
      if (err) {
        return console.error(`exec error: ${err}`)
      }
      // Write to stdout just for some quick debugging of our experiment
      console.log(`stdout: ${stdout}`)

      // Convert OBJ file into JSON using wavefront-obj-parser
      cp.exec(
        `cat ${wavefrontPath} | node ./node_modules/wavefront-obj-parser/bin/obj2json.js > ${jsonPath}`,
        function (err, stdout, stderr) {
          if (err) { throw err }

          // Send JSON file to connected clients
          fs.readFile(jsonPath, function (err, jsonModelFile) {
            if (err) { throw err }

            for (var clientId in connectedClients) {
              if (connectedClients[clientId].readyState === WebSocket.OPEN) {
                connectedClients[clientId].send(
                  jsonModelFile.toString()
                )
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

// Start WebSocket server and keep track of currently connected clients
wsServer.on('connection', function (ws) {
  ws.clientId = cuid()
  connectedClients[ws.clientId] = ws

  ws.on('close', function () {
    delete connectedClients[ws.clientId]
  })
})
