var glMat4 = require('gl-mat4')
var expandVertexData = require('expand-vertex-data')

var canvas = document.createElement('canvas')
canvas.width = 600
canvas.height = 600
document.body.append(canvas)

var isDragging = false
var xCameraRot = Math.PI / 3
var yCameraRot = 0
var lastX
var lastY
canvas.onmousedown = function (e) {
  isDragging = true
  lastX = e.pageX
  lastY = e.pageY
}
canvas.onmousemove = function (e) {
  if (isDragging) {
    xCameraRot += (e.pageY - lastY) / 60
    yCameraRot -= (e.pageX - lastX) / 60

    xCameraRot = Math.min(xCameraRot, Math.PI / 2.3)
    xCameraRot = Math.max(-0.5, xCameraRot)

    lastX = e.pageX
    lastY = e.pageY
  }
}
canvas.onmouseup = function () {
  isDragging = false
}

var gl = canvas.getContext('webgl')
gl.clearColor(0.0, 0.0, 0.0, 1.0)
gl.enable(gl.DEPTH_TEST)

var vertexGLSL = `
attribute vec3 aVertexPos;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPos, 1.0);
}
`

var fragmentGLSL = `
precision mediump float;

void main (void) {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`

var vertexShader = gl.createShader(gl.VERTEX_SHADER)
console.log(gl.getShaderInfoLog(vertexShader))
gl.shaderSource(vertexShader, vertexGLSL)
gl.compileShader(vertexShader)

var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
console.log(gl.getShaderInfoLog(fragmentShader))
gl.shaderSource(fragmentShader, fragmentGLSL)
gl.compileShader(fragmentShader)

var shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)

var vertexPosAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPos')
gl.enableVertexAttribArray(vertexPosAttrib)

var vertexPosBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([]), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPosAttrib, 3, gl.FLOAT, false, 0, 0)

var vertexIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([]), gl.STATIC_DRAW)

var mVMatrixUni = gl.getUniformLocation(shaderProgram, 'uMVMatrix')
var pMatrixUni = gl.getUniformLocation(shaderProgram, 'uPMatrix')

gl.uniformMatrix4fv(pMatrixUni, false, glMat4.perspective([], Math.PI / 3, 1, 0.1, 100))

var ws = new window.WebSocket('ws://127.0.0.1:8989')
ws.onmessage = function (message) {
  var vertexData = JSON.parse(message.data)

  // FIXME: Pull into expand-vertex-data behind an `opts.decode` flag
  var decodedPositionIndices = []
  for (var i = 0; i < vertexData.vertexIndex.length / 4; i++) {
    decodedPositionIndices.push(vertexData.vertexIndex[i * 4])
    decodedPositionIndices.push(vertexData.vertexIndex[i * 4 + 1])
    decodedPositionIndices.push(vertexData.vertexIndex[i * 4 + 2])
    // If this is a face with 4 vertices we push a second triangle
    if (vertexData.vertexIndex[i * 4 + 3] !== -1) {
      decodedPositionIndices.push(vertexData.vertexIndex[i * 4])
      decodedPositionIndices.push(vertexData.vertexIndex[i * 4 + 2])
      decodedPositionIndices.push(vertexData.vertexIndex[i * 4 + 3])
    }
  }

  // TODO: Update wf-obj-parser property names to match expand-vertex-data
  vertexData.vertexPositions = vertexData.vertex
  vertexData.vertexNormals = vertexData.normal
  vertexData.vertexUVs = vertexData.uv
  vertexData.vertexPositionIndices = decodedPositionIndices
  vertexData.vertexUVIndices = vertexData.uvIndex
  vertexData.vertexNormalIndices = vertexData.normalIndex
  vertexData = expandVertexData(vertexData)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData.positions), gl.STATIC_DRAW)
  gl.vertexAttribPointer(vertexPosAttrib, 3, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexData.positionIndices), gl.STATIC_DRAW)

  numIndicesToDraw = decodedPositionIndices.length
}

var numIndicesToDraw
function draw () {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  var camera = glMat4.create()
  var xCameraMatrix = glMat4.create()
  var yCameraMatrix = glMat4.create()
  glMat4.translate(camera, camera, [0, 0, 8])
  glMat4.rotateX(xCameraMatrix, xCameraMatrix, -xCameraRot)
  glMat4.rotateY(yCameraMatrix, yCameraMatrix, yCameraRot)
  glMat4.multiply(camera, xCameraMatrix, camera)
  glMat4.multiply(camera, yCameraMatrix, camera)
  camera = glMat4.lookAt([], [camera[12], camera[13], camera[14]], [0, 0, 0], [0, 1, 0])
  gl.uniformMatrix4fv(mVMatrixUni, false, camera)

  gl.drawElements(gl.TRIANGLES, numIndicesToDraw, gl.UNSIGNED_SHORT, 0)

  window.requestAnimationFrame(draw)
}
draw()
