import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrateModels() {
  const modelsDir = path.join(__dirname, 'models');
  const files = fs.readdirSync(modelsDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(modelsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/const mongoose = require\('mongoose'\);/g, "import mongoose from 'mongoose';");
    content = content.replace(/module\.exports = /g, "export default ");
    fs.writeFileSync(filePath, content);
    console.log(`Migrated model: ${file}`);
  }
}

function migrateRoutes() {
  const routesDir = path.join(__dirname, 'routes');
  const files = fs.readdirSync(routesDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // express config
    content = content.replace(/const express = require\('express'\);/g, "import express from 'express';");
    
    // controllers
    content = content.replace(/const (.+?) = require\('\.\.\/controllers\/(.+?)'\);/g, "import $1 from '../controllers/$2.js';");
    
    // middleware
    content = content.replace(/const { (.+?) } = require\('\.\.\/middleware\/(.+?)'\);/g, "import { $1 } from '../middleware/$2.js';");
    
    // exports
    content = content.replace(/module\.exports = router;/g, "export default router;");
    
    fs.writeFileSync(filePath, content);
    console.log(`Migrated route: ${file}`);
  }
}

migrateModels();
migrateRoutes();
