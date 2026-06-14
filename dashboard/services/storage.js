'use strict';

const path = require('path');
const fs = require('fs-extra');

class Storage {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  _filePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  async _ensureDir() {
    await fs.ensureDir(this.dataDir);
  }

  async read(collection) {
    const filePath = this._filePath(collection);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async write(collection, data) {
    await this._ensureDir();
    const filePath = this._filePath(collection);
    const tmpPath = filePath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  async findById(collection, id) {
    const items = await this.read(collection);
    return items.find((item) => item.id === id) || null;
  }

  async insert(collection, item) {
    const items = await this.read(collection);
    items.push(item);
    await this.write(collection, items);
    return item;
  }

  async update(collection, id, patch) {
    const items = await this.read(collection);
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    items[idx] = Object.assign({}, items[idx], patch);
    await this.write(collection, items);
    return items[idx];
  }

  async delete(collection, id) {
    const items = await this.read(collection);
    const filtered = items.filter((item) => item.id !== id);
    await this.write(collection, filtered);
    return filtered.length < items.length;
  }

  async findWhere(collection, predicate) {
    const items = await this.read(collection);
    return items.filter(predicate);
  }
}

module.exports = Storage;
