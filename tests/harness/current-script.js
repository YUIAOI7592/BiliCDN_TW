'use strict'
const path = require('node:path')
module.exports = process.env.BILICDN_TEST_TARGET || path.resolve(__dirname, '../../dist/BiliCDN_TW.user.js')
