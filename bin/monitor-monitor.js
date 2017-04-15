#!/usr/bin/env node

'use strict'

const path = require('path')
const exec = require('child_process').exec

const program = require('commander')
const EdidReader = require('edid-reader')
const edidReader = new EdidReader()
const udev = require('udev')

let monitorSetups

program
  .version('1.0.0')
  .arguments('<jsonConfigFile>')
  .action((jsonConfigFile) => {
    if (jsonConfigFile) {
      const cwd = process.cwd()
      const configFilePath = path.resolve(cwd, jsonConfigFile)
      const json = require('fs').readFileSync(configFilePath)
      monitorSetups = JSON.parse(json)
    }
  })
  .parse(process.argv)

if (monitorSetups == null) {
  console.error('Missing JSON config file for monitor setups!')
  program.outputHelp()
  process.exit(1)
}

// GLOBAL STATE!
let lastSetupKey

async function getCurrentSetupKey() {

  await edidReader.scan()
  return edidReader.monitors
    .map((monitor) => {
      return [monitor.vendor, monitor.productCode, monitor.modelName]
        .map((a) => a || 'unknown')
        .join('/')
    })
    .join(',')
}

async function applySetup(setupKey) {

  if (setupKey === lastSetupKey) {
    return false
  }

  lastSetupKey = setupKey

  const { name, xrandrCommand } = monitorSetups[setupKey]
  exec(xrandrCommand, (err, stdout) => {
    if (err) {
      console.error(err)
    }
  })

  return name
}

async function updateSetup() {

  const setupKey = await getCurrentSetupKey()
  console.log('Current monitor setup is', setupKey)

  const appliedSetupName = await applySetup(setupKey)
  if (appliedSetupName) {
    console.log('Monitor configuration was applied for', appliedSetupName)
  }
}

// DO IT NOW
updateSetup().catch((e) => console.error(e))

// DO IT ON EVENT CHANGE
const monitorUdevDevices = udev.monitor()
monitorUdevDevices.on('add', () => updateSetup())
monitorUdevDevices.on('remove', () => updateSetup())
monitorUdevDevices.on('change', () => updateSetup())
