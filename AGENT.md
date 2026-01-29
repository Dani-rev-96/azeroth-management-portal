# Project Description

This project is a web application for managing and interacting with World of Warcraft private servers. It provides features such as character management, shop purchases, and community engagement tools. The application is built using modern web technologies including Vue.js and Pinia for state management.

# Agent Instructions

## general

- For all changes which target style, components or otherwise shared code: Make a broader project analysis to ensure consistency across the project.
- shared utilities should be imported from utils folder instead of re-exporting from other stores.
- remove any unused or redundant code, especially in styles and store exports.
- always try to unify styles and reuse code where possible.

## frontend

- ensure that pages are as clean and minimal as possible, removing unnecessary styles or code and make use of vue components, which should be scoped.
- pinia stores should be in compositon API style.

## backend

- ensure that all data fetching and state management is handled in pinia stores.
- ensure database access is optimized, follows best practices and is unified as much as possible.

## documentation

- ensure that all code changes are properly documented in README.md and linked documentation files.
- update AGENT.md with any new instructions or changes to existing instructions, ensuring clarity and conciseness keep it as short as possible.
