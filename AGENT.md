# Project Description

This project is a web application for managing and interacting with World of Warcraft private servers. It provides features such as character management, shop purchases, and community engagement tools. The application is built using modern web technologies including Vue.js and Pinia for state management.

# Agent Instructions

## structure

- /app: all vue components, pages, styles and pinia stores related to the user interface.
  - /utils: shared utilities and helper functions used across the project.
- /server: all backend related code, including data fetching, business logic and database interactions.
  - /utils: shared utilities and helper functions used across the project.
  - /assets: sqlite database files for the application. They are exported from mpq files which itself has ClientDatabase (.dbc) files which are used by the game client.
  - /api: api related code for handling requests and responses.
  - /services: business logic and data processing.
- /shared: code shared between frontend and backend.
- /data: exports from client data and other relevant data files and or tools not directly used by the application but useful for development or analysis.
  - /png: png images exported from mpq files. (unused by the application)
  - /dbcJsons: json exports from client database (.dbc) files. (unused by the application, helpfull for new features to create the sqlite databases)
- /scripts: scripts for automating tasks such as database updates or data processing.

## general

- For all changes which target style, components or otherwise shared code: Make a broader project analysis to ensure consistency across the project.
- shared utilities should be imported from utils folder instead of re-exporting from other stores.
- remove any unused or redundant code, especially in styles and store exports.
- always try to unify styles and reuse code where possible.

## frontend

- ensure that pages are as clean and minimal as possible, removing unnecessary styles or code and make use of vue components, which should be scoped.
- pinia stores should be in compositon API style.
- always check the scss mixins and variables for existing styles before adding new ones. Also ensure variables acutally exist.

## backend

- ensure that all data fetching and state management is handled in pinia stores.
- ensure database access is optimized, follows best practices and is unified as much as possible.

## documentation

- ensure that all code changes are properly documented in README.md and linked documentation files.
- update AGENT.md with any new instructions or changes to existing instructions, ensuring clarity and conciseness keep it as short as possible.

## external dokumentation

- world database, called acore_world: https://www.azerothcore.org/wiki/database-world
- characters database, called acore_characters: https://www.azerothcore.org/wiki/database-characters
- gm commands for soap calls: https://www.azerothcore.org/wiki/gm-commands
- eluna api documentation: https://www.azerothcore.org/eluna/
