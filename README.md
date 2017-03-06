# Task management
A simple task management app (front-end and backend) using NodeJS / mySQL / Ionic-2

## Description
This is a simple task management app build using Ionic-2 / NodeJS / mySQL.
The nodeJS part is inside the root of the repository, the Ionic-2 application is inside the 'public' directory.

## Installation
* Install npm/node
* Install ionic cli:
```
npm install -g ionic
```
* Create a database/user 'taskmanagement' inside mySQL with password (see models/index.js). No need to create the tables, that is handled automatically by nodeJS.

## Execution
Go to the main directory of the repo:
```
npm install
npm start
```
The first command will build the Ionic app as well, so no need to do 'ionic build' or 'ionic serve'.

Then start the front-end Ionic app via a browser on http://localhost:3000

## Changing front-end
As Ionic requires a build phase after changes to the code, it is advised to keep 'ionic serve' running in a terminal window. But keep using the 'http://localhost:3000' instead of the default Ionic one.

## Running tests
Some initial back-end tests are added to the repo. These can be run using:
```
npm test
```
