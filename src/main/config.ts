// Contains runtime configuration for the Drupal Launcher.

import { app } from 'electron';
import path from 'node:path';
import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Parse the command line so we can override certain things for testing.
const argv = yargs(
        hideBin(process.argv),
    )
    .option('root', {
        type: 'string',
        description: 'The absolute path to the Drupal project root.',
        default: path.join(app.getPath('documents'), 'drupal'),
    })
    .option('fixture', {
        type: 'string',
        description: 'The path of a fixture from which to create the Drupal project. This is internal and only used for testing.',
        default: null,
        hidden: true,
    })
    .parse();

// The Drupal project root.
export const projectRoot: string = argv.root;

// Where additional resources are stored. This varies depending on whether the app has
// been packaged for release.
export const resourceDir = app.isPackaged ? process.resourcesPath : app.getAppPath();

// Absolute path of the directory with the PHP and Composer binaries.
export const bin: string = path.join(resourceDir, 'bin');

// A file where we can log Composer's full output for debugging purposes.
export const installLog: string = path.join(app.getPath('temp'), 'install.log');

// The series of Composer commands to set up the Drupal project.
export const installCommands: string[][] = [
    // Create the project, but don't install dependencies yet.
    ['create-project', '--no-install', 'drupal/cms', projectRoot],

    // Prevent core's scaffold plugin from trying to dynamically determine if
    // the project is a Git repository, since that will make it try to run Git,
    // which might not be installed.
    ['config', 'extra.drupal-scaffold.gitignore', 'false', '--json'],

    // Require Composer as a dev dependency so that Package Manager can use it
    // without relying on this app.
    ['require', '--dev', '--no-update', 'composer/composer'],

    // Finally, install dependencies. We suppress the progress bar because it
    // looks lame when streamed to the renderer.
    ['install', '--no-progress'],

    // Unpack all recipes. This would normally be done during the `create-project` command
    // if dependencies were being installed at that time.
    ['drupal:recipe-unpack'],
];

// Only allow a fixture to be used if the app is not packaged (i.e., during development or
// when running tests).
if (argv.fixture && ! app.isPackaged) {
    // The option does not need to be escaped or quoted, because Composer is not being
    // executed through a shell.
    installCommands[0].push(`--repository={"type":"path","url":"${argv.fixture}"}`);
}

// The absolute path of the web root.
// @todo Determine this dynamically at install time, and store it.
export const webRoot: string = path.join(projectRoot, 'web');
