var glMat4 = require('gl-mat4')
var glVec3 = require('gl-vec3')
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
attribute vec3 aVertexNormal;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vNormal;
varying vec3 vWorldSpacePos;

void main (void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPos, 1.0);

  vNormal = aVertexNormal;
  // World space is same as model space since model matrix is identity
  vWorldSpacePos = aVertexPos;
}
`

var fragmentGLSL = `
precision mediump float;

uniform vec3 uLightPos;
uniform vec3 uCameraPos;

varying vec3 vNormal;
varying vec3 vWorldSpacePos;

void main (void) {
  float ambientStrength = 0.1;
  vec3 ambient = ambientStrength * vec3(1.0, 1.0, 1.0);

  vec3 lightColor = vec3(1.0, 0.0, 0.0);

  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightPos - vWorldSpacePos);
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = diff * vec3(0.5, 0.2, 0.3);
  diffuse = diff * lightColor;

  float specularStrength = 0.5;
  vec3 viewDir = normalize(uCameraPos - vWorldSpacePos);
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
  vec3 specular = specularStrength * spec * lightColor;

  gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
}
`

var vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertexShader, vertexGLSL)
gl.compileShader(vertexShader)
console.log(gl.getShaderInfoLog(vertexShader))

var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragmentShader, fragmentGLSL)
gl.compileShader(fragmentShader)
console.log(gl.getShaderInfoLog(fragmentShader))

var shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)

var vertexPosAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPos')
gl.enableVertexAttribArray(vertexPosAttrib)
var vertexNormalAttrib = gl.getAttribLocation(shaderProgram, 'aVertexNormal')
gl.enableVertexAttribArray(vertexNormalAttrib)

var vertexPosBuffer = gl.createBuffer()
var vertexNormalBuffer = gl.createBuffer()

gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([]), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexPosAttrib, 3, gl.FLOAT, false, 0, 0)

gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([]), gl.STATIC_DRAW)
gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0)

var vertexIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([]), gl.STATIC_DRAW)

var mVMatrixUni = gl.getUniformLocation(shaderProgram, 'uMVMatrix')
var pMatrixUni = gl.getUniformLocation(shaderProgram, 'uPMatrix')
var lightPosUni = gl.getUniformLocation(shaderProgram, 'uLightPos')
var cameraPosUni = gl.getUniformLocation(shaderProgram, 'uCameraPos')

gl.uniformMatrix4fv(pMatrixUni, false, glMat4.perspective([], Math.PI / 3, 1, 0.1, 100))

var ws = new window.WebSocket('ws://127.0.0.1:8989')
ws.onmessage = function (message) {
  var vertexData = JSON.parse(message.data)
  vertexData = expandVertexData(vertexData, {facesToTriangles: true})

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData.positions), gl.STATIC_DRAW)
  gl.vertexAttribPointer(vertexPosAttrib, 3, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData.normals), gl.STATIC_DRAW)
  gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexData.positionIndices), gl.STATIC_DRAW)

  numIndicesToDraw = vertexData.positionIndices.length
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

  gl.uniform3fv(cameraPosUni, [camera[12], camera[13], camera[14]])

  camera = glMat4.lookAt([], [camera[12], camera[13], camera[14]], [0, 0, 0], [0, 1, 0])
  gl.uniformMatrix4fv(mVMatrixUni, false, camera)

  var worldSpaceLightPos = [0, 5, 0]
  gl.uniform3fv(lightPosUni, worldSpaceLightPos)

  gl.drawElements(gl.TRIANGLES, numIndicesToDraw, gl.UNSIGNED_SHORT, 0)

  window.requestAnimationFrame(draw)
}
draw()
