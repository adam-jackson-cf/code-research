# GitHub Copilot Features

**Source:** https://docs.github.com/en/copilot/get-started/features
**Scraped:** 2025-11-05

---

## Overview

GitHub Copilot offers a suite of features for developers and administrators to enhance productivity and code quality.

## Table of Contents

- [GitHub Copilot Features](#github-copilot-features)
  - [Code Completion](#code-completion)
  - [Copilot Chat](#copilot-chat)
  - [Copilot Coding Agent](#copilot-coding-agent)
  - [Copilot CLI (Public Preview)](#copilot-cli-public-preview)
  - [Copilot Code Review](#copilot-code-review)
  - [Copilot Pull Request Summaries](#copilot-pull-request-summaries)
  - [Copilot Text Completion (Public Preview)](#copilot-text-completion-public-preview)
  - [Copilot Extensions](#copilot-extensions)
  - [Copilot Edits](#copilot-edits)
  - [Copilot Custom Instructions](#copilot-custom-instructions)
  - [Copilot in GitHub Desktop](#copilot-in-github-desktop)
  - [Copilot Spaces](#copilot-spaces)
  - [Copilot Knowledge Bases (Enterprise Only)](#copilot-knowledge-bases-enterprise-only)
  - [GitHub Spark (Public Preview)](#github-spark-public-preview)
- [Features for Administrators](#features-for-administrators)
  - [Policy Management](#policy-management)
  - [Access Management](#access-management)
  - [Usage Data](#usage-data)
  - [Audit Logs](#audit-logs)
  - [Exclude Files](#exclude-files)

---

## GitHub Copilot Features

### Code Completion

Autocomplete-style suggestions from Copilot in supported IDEs:

- Visual Studio Code
- Visual Studio
- JetBrains IDEs
- Azure Data Studio
- Xcode
- Vim/Neovim
- Eclipse

See [Getting code suggestions in your IDE with GitHub Copilot](https://docs.github.com/en/copilot/using-github-copilot/getting-code-suggestions-in-your-ide-with-github-copilot).

**VS Code Feature:** If you use VS Code, you can also use next edit suggestions, which will predict the location of the next edit you are likely to make and suggest a completion for it.

### Copilot Chat

A chat interface that lets you ask coding-related questions. GitHub Copilot Chat is available:

- On the GitHub website
- In GitHub Mobile
- In supported IDEs (Visual Studio Code, Visual Studio, JetBrains IDEs, Eclipse IDE, and Xcode)
- In Windows Terminal

Users can also use skills with Copilot Chat.

See:

- [Asking GitHub Copilot questions in GitHub](https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-github)
- [Asking GitHub Copilot questions in your IDE](https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide)

### Copilot Coding Agent

An autonomous AI agent that can make code changes for you. You can assign a GitHub issue to Copilot and the agent will work on making the required changes, and will create a pull request for you to review. You can also ask Copilot to create a pull request from Copilot Chat.

See [GitHub Copilot coding agent](https://docs.github.com/en/copilot/using-github-copilot/coding-agent).

### Copilot CLI (Public Preview)

A command line interface that lets you use Copilot from within the terminal. You can:

- Get answers to questions
- Ask Copilot to make changes to your local files
- Interact with GitHub.com (e.g., listing open pull requests or creating issues)

See [About GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

### Copilot Code Review

AI-generated code review suggestions to help you write better code.

See [Using GitHub Copilot code review](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review).

**Note:** New tools in Copilot code review is in public preview and subject to change. See [About GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review).

### Copilot Pull Request Summaries

AI-generated summaries of the changes that were made in a pull request, which files they impact, and what a reviewer should focus on when they conduct their review.

See [Creating a pull request summary with GitHub Copilot](https://docs.github.com/en/copilot/using-github-copilot/creating-a-pull-request-summary-with-github-copilot).

### Copilot Text Completion (Public Preview)

AI-generated text completion to help you write pull request descriptions quickly and accurately.

See [Writing pull request descriptions with GitHub Copilot text completion](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-text-completion).

### Copilot Extensions

GitHub Copilot Extensions are a type of GitHub App that integrates the power of external tools into GitHub Copilot Chat. Copilot Extensions can be:

- Developed by anyone
- Used privately or publicly
- Shared with others through the GitHub Marketplace

See [About GitHub Copilot Extensions](https://docs.github.com/en/copilot/concepts/copilot-extensions/about-copilot-extensions).

### Copilot Edits

Copilot Edits is available in Visual Studio Code, Visual Studio, and JetBrains IDEs. Use Copilot Edits to make changes across multiple files directly from a single Copilot Chat prompt.

#### Edit Mode

**Availability:** Visual Studio Code and JetBrains IDEs only.

Use edit mode when you want more granular control over the edits that Copilot proposes. In edit mode, you:

- Choose which files Copilot can make changes to
- Provide context to Copilot with each iteration
- Decide whether or not to accept the suggested edits after each turn

**Best suited for:**

- Making quick, specific updates to a defined set of files
- Having full control over the number of LLM requests Copilot uses

#### Agent Mode

Use agent mode when you have a specific task in mind and want to enable Copilot to autonomously edit your code. In agent mode, Copilot:

- Determines which files to make changes to
- Offers code changes and terminal commands to complete the task
- Iterates to remediate issues until the original task is complete

**Best suited for:**

- Complex tasks involving multiple steps, iterations, and error handling
- Tasks where you want Copilot to determine the necessary steps
- Tasks requiring integration with external applications (such as an MCP server)

### Copilot Custom Instructions

Enhance Copilot Chat responses by providing contextual details on your preferences, tools, and requirements.

See [About customizing GitHub Copilot responses](https://docs.github.com/en/copilot/concepts/about-customizing-github-copilot-chat-responses).

### Copilot in GitHub Desktop

Automatically generate commit messages and descriptions with Copilot in GitHub Desktop based on the changes you make to your project.

### Copilot Spaces

Organize and centralize relevant content—like code, docs, specs, and more—into Spaces that ground Copilot's responses in the right context for a specific task.

See [About GitHub Copilot Spaces](https://docs.github.com/en/copilot/using-github-copilot/copilot-spaces/about-organizing-and-sharing-context-with-copilot-spaces).

### Copilot Knowledge Bases (Enterprise Only)

Create and manage collections of documentation to use as context for chatting with Copilot. When you ask a question in Copilot Chat in GitHub or in VS Code, you can specify a knowledge base as the context for your question.

See [Creating and managing GitHub Copilot knowledge bases](https://docs.github.com/en/copilot/customizing-copilot/managing-copilot-knowledge-bases).

### GitHub Spark (Public Preview)

Build and deploy full-stack applications using natural-language prompts that seamlessly integrate with the GitHub platform for advanced development.

See [Building and deploying AI-powered apps with GitHub Spark](https://docs.github.com/en/copilot/tutorials/spark/build-apps-with-spark).

---

## Features for Administrators

The following features are available to organization and enterprise owners with a Copilot Business or Copilot Enterprise plan.

### Policy Management

Manage policies for Copilot in your organization or enterprise.

See:

- [Managing policies and features for GitHub Copilot in your organization](https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/setting-policies-for-copilot-in-your-organization/managing-policies-for-copilot-in-your-organization)
- [Managing policies and features for GitHub Copilot in your enterprise](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-for-your-enterprise/managing-policies-and-features-for-copilot-in-your-enterprise)

### Access Management

Enterprise owners can specify which organizations in the enterprise can use Copilot, and organization owners can specify which organization members can use Copilot.

See:

- [Managing access to GitHub Copilot in your organization](https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/managing-access-to-github-copilot-in-your-organization)
- [Managing access to Copilot in your enterprise](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-for-your-enterprise/managing-access-to-copilot-in-your-enterprise)

### Usage Data

Review Copilot usage data within your organization or enterprise to inform how to manage access and drive adoption of Copilot.

See:

- [Reviewing user activity data for GitHub Copilot in your organization](https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/reviewing-activity-related-to-github-copilot-in-your-organization/reviewing-user-activity-data-for-copilot-in-your-organization)
- [Viewing Copilot license usage in your enterprise](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-for-your-enterprise/managing-access-to-copilot-in-your-enterprise/viewing-copilot-license-usage-in-your-enterprise)

### Audit Logs

Review audit logs for Copilot in your organization to understand what actions have been taken and by which users.

See [Reviewing audit logs for GitHub Copilot Business](https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/reviewing-activity-related-to-github-copilot-in-your-organization/reviewing-audit-logs-for-copilot-business).

### Exclude Files

Configure Copilot to ignore certain files. This can be useful if you have files that you don't want to be available to Copilot.

See [Excluding content from GitHub Copilot](https://docs.github.com/en/copilot/managing-copilot/managing-github-copilot-in-your-organization/setting-policies-for-copilot-in-your-organization/excluding-content-from-github-copilot).

---

## Next Steps

- To learn more about the plans available for GitHub Copilot, see [Plans for GitHub Copilot](https://docs.github.com/en/copilot/about-github-copilot/subscription-plans-for-github-copilot).
- To start using Copilot, see [Setting up GitHub Copilot](https://docs.github.com/en/copilot/setting-up-github-copilot).
