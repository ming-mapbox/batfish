#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sitemapStatic = require('sitemap-static');

/**
 * Build a sitemap cataloging the HTML files in the outputDirectory.
 *
 * @param {Object} batfishConfig
 * @return {Promise<void>} - Resolves when the sitemap is written.
 */
function generateSitemap(batfishConfig) {
  const sitemapWriter = fs.createWriteStream(
    path.join(batfishConfig.outputDirectory, 'sitemap.xml')
  );
  return new Promise((resolve, reject) => {
    sitemapStatic(
      sitemapWriter,
      {
        findRoot: batfishConfig.outputDirectory,
        prefix: batfishConfig.siteOrigin + batfishConfig.siteBasePath,
        pretty: true
      },
      error => {
        if (error) return reject(error);
        resolve();
      }
    );
  });
}

module.exports = generateSitemap;