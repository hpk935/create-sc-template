#!/usr/bin/env node

import inquirer from "inquirer";
import * as fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// template dir
const __dirname = dirname(fileURLToPath(import.meta.url));
// curr dir
const CURR_DIR = process.cwd();

const CHOICES = fs.readdirSync(`${__dirname}/templates`);
const QUESTIONS = [
  {
    name: "project-choice",
    type: "list",
    message: "What project template would you like to generate?",
    choices: CHOICES,
  },
  {
    name: "db-choice",
    type: "list",
    message: "Which database would you like to use?",
    choices: ["mongodb", "postgresql"],
    when: (answers) => answers["project-choice"] === "next",
  },
  {
    name: "project-name",
    type: "input",
    message: "Project name:",
    validate: function (input) {
      if (/^([A-Za-z\-\\_\d])+$/.test(input)) return true;
      else
        return "Project name may only include letters, numbers, underscores and hashes.";
    },
  },
];

inquirer.prompt(QUESTIONS).then((answers) => {
  const projectChoice = answers["project-choice"];
  const projectName = answers["project-name"];
  const dbChoice = answers["db-choice"];
  const templatePath = `${__dirname}/templates/${projectChoice}`;

  fs.mkdirSync(`${CURR_DIR}/${projectName}`);

  createDirContent(templatePath, projectName);

  // for next template: fetch latest versions and inject db dependencies
  if (projectChoice === "next") {
    const pkgPath = `${CURR_DIR}/${projectName}/package.json`;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    // fetch latest next version (mirrors create-next-app behavior)
    try {
      const nextVersion = execSync("npm view next version", {
        encoding: "utf8",
      }).trim();
      pkg.dependencies["next"] = nextVersion;
      pkg.devDependencies["eslint-config-next"] = nextVersion;
    } catch {
      console.warn(
        "Could not fetch latest next version, using template default.",
      );
    }

    // copy db overlay files and inject db dependencies
    if (dbChoice) {
      const dbOverlayPath = `${templatePath}/_db/${dbChoice}`;
      createDirContent(dbOverlayPath, projectName);

      if (dbChoice === "mongodb") {
        pkg.dependencies["mongoose"] = "^8";
      } else if (dbChoice === "postgresql") {
        pkg.dependencies["drizzle-orm"] = "^0.44";
        pkg.dependencies["postgres"] = "^3";
        pkg.devDependencies["drizzle-kit"] = "^0.31";
      }
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
  }

  console.log("Installing dependencies...");
  const npmInstall = runCommand(`cd ${projectName} && npm i`);
  if (!npmInstall) process.exit(1);

  console.log("Setting up local git...");
  const setupGit = runCommand(
    `cd ${projectName} && git init && git add . && git commit -m 'initial d'`,
  );
  if (!setupGit) process.exit(1);

  console.log(`----------------------`);
  console.log(`ALL DONE!! ୧༼ಠ益ಠ༽୨`);
  console.log(`"cd ${projectName}" and "npm run dev" to get started!`);
});

// -r function for copy all content
function createDirContent(templatePath, newProjectPath) {
  const filesToCreate = fs.readdirSync(templatePath);

  filesToCreate.forEach((file) => {
    const origFilePath = `${templatePath}/${file}`;
    const fileType = fs.statSync(origFilePath);

    // skip overlay directories (prefixed with _)
    if (file.startsWith("_") && fileType.isDirectory()) return;

    if (fileType.isFile()) {
      const content = fs.readFileSync(origFilePath, "utf8");
      // .gitignore issue
      if (file === "gitignore.temp") file = ".gitignore";

      const writePath = `${CURR_DIR}/${newProjectPath}/${file}`;

      fs.writeFileSync(writePath, content, "utf8");
      console.log(`Creating ${writePath}`);
    } else if (fileType.isDirectory()) {
      fs.mkdirSync(`${CURR_DIR}/${newProjectPath}/${file}`);

      // recursive call
      createDirContent(`${templatePath}/${file}`, `${newProjectPath}/${file}`);
    }
  });
}

// run command in cli
const runCommand = (command) => {
  try {
    execSync(`${command}`, { stdio: "inherit" });
  } catch (err) {
    console.error(`Failed to execute ${command}`, err);
    return false;
  }
  return true;
};
