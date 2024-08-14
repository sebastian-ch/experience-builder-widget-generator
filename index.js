#!/usr/bin/env node

import { program } from 'commander';
import { input, select } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import { Octokit } from 'octokit';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const octokit = new Octokit();

const REPO_OWNER = 'Esri';
const REPO_NAME = 'arcgis-experience-builder-sdk-resources';
const WIDGETS_PATH = 'widgets';

async function getWidgets() {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: WIDGETS_PATH,
        });

        return data
            .filter(item => item.type === 'dir')
            .map(item => ({ value: item.name, label: item.name }));
    } catch (error) {
        console.error('Error fetching widgets:', error.message);
        return [];
    }
}

async function copyWidget(widget, destination) {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `${WIDGETS_PATH}/${widget}`,
        });

        for (const item of data) {
            if (item.type === 'file') {
                const fileContent = await octokit.rest.repos.getContent({
                    owner: REPO_OWNER,
                    repo: REPO_NAME,
                    path: item.path,
                });

                const content = Buffer.from(fileContent.data.content, 'base64').toString('utf-8');
                await fs.outputFile(path.join(destination, item.name), content);
            } else if (item.type === 'dir') {
                await copyWidget(`${widget}/${item.name}`, path.join(destination, item.name));
            }
        }
    } catch (error) {
        console.error('Error copying widget:', error.message);
    }
}

program
    .name('create-widget')
    .description('Generate a custom widget template for ArcGIS Experience Builder')
    .version('1.1.1');

program.action(async () => {
    const widgets = await getWidgets();

    const widgetName = await input({
        message: 'Enter the new widget name:',
        validate: input => input.trim() !== '' || 'Widget name is required'
    });

    const selectedWidget = await select({
        message: 'Choose a widget template:',
        choices: widgets
    });

    console.log(`Generating widget: ${widgetName} using ${selectedWidget} template`);

    const widgetDir = path.join(process.cwd(), widgetName);

    await copyWidget(selectedWidget, widgetDir);

    // Modify package.json if it exists
    const packageJsonPath = path.join(widgetDir, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        packageJson.name = widgetName;
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    }

    console.log('Widget template created successfully!');
});

program.parse(process.argv);