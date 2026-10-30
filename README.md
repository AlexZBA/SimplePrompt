# SimplePrompt

**English** | [简体中文](./README.zh-CN.md)

A beginner-friendly bilingual prompt builder with artist previews, favorites, a blacklist, and model-specific artist formatting.

[Open SimplePrompt](https://alexzba.github.io/SimplePrompt/)

## Current version

Version 1.6 includes 76 artists, 304 bundled previews, and 3741 bilingual tags. Artist images are served from this repository's assets/artist-images directory using relative URLs. Viewing previews requires no Python service, external image host, or login.

## Usage

Open the online version, or download and extract the full repository and open index.html. Keep css, js, data, and assets beside index.html. Downloading only index.html will omit the application data and previews.

Favorites, blacklists and settings stay in the current browser. Language can be changed in Settings. Artist previews and tags can be browsed and searched in Chinese and English.

## GitHub Pages

Publish from the main branch root. The bundled .nojekyll file keeps deployment static. Relative image URLs support the /SimplePrompt/ project path.

## Sources and license

Tag data references Latent Tags / Danbooru. Artist descriptors are editorial mappings from published commentary and interviews, not universal classifications. Public provenance is in docs/data-sources.json and docs/style-tag-research.json. New artwork previews were filtered using source metadata, not all individually visually reviewed.

Software code is licensed under the MIT License, copyright AlexZBA. Third-party artwork belongs to its creators and is not relicensed under MIT. Removal requests may be submitted through repository Issues.

This project was developed with programming assistance from ChatGPT.
