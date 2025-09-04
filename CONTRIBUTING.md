# Contributing to EpicStaff

First off, thank you for considering contributing to EpicStaff! We're thrilled you're here. This project is driven by its community, and every contribution, no matter how small, helps us build a better platform.

This document provides a set of guidelines for contributing to EpicStaff. These are mostly guidelines, not strict rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by the [EpicStaff Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to **contact@epicstaff.ai**.

## How Can I Contribute?

There are many ways to contribute, and not all of them involve writing code.

* **Reporting Bugs:** If you find a bug, please open an issue and provide as much detail as possible, including steps to reproduce it.
* **Suggesting Enhancements:** Have an idea for a new feature or an improvement to an existing one? Open an issue with the `enhancement` label or start a discussion in our [GitHub Discussions](https://github.com/EpicStaff/EpicStaff/discussions).
* **Improving Documentation:** If you notice something is unclear in the docs or the README, you can submit a pull request with your improvements.
* **Writing Code:** Help us fix bugs or build new features. This is a great way to get involved.

## Your First Code Contribution

Ready to write some code? Here’s how to get started. We have a list of beginner-friendly issues that are a great place to start.

[cite_start]➡️ **[Find a "Good First Issue"](ghjk)** 

### Local Development Setup

1.  **Fork the repository:** Click the "Fork" button at the top right of this page. This creates a copy of the repository in your own GitHub account.
2.  **Clone your fork:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/EpicStaff.git](https://github.com/YOUR_USERNAME/EpicStaff.git)
    cd EpicStaff
    ```
3.  **Create a new branch:** Create a branch from `main` for your changes. Choose a descriptive name.
    ```bash
    git checkout -b your-feature-branch-name
    ```
4.  **Set up the environment:** (Note: Please adapt if your project has a different setup process)
    *We recommend using a Python virtual environment.*
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements-dev.txt
    ```
5.  **Make your changes:** Now you can open the code in your favorite editor and start making changes.
6.  **Run tests:** Before submitting, make sure all tests pass.
    ```bash
    # (Example command, please replace with your actual test command)
    pytest
    ```
7.  **Commit your changes:** Use a clear and descriptive commit message.
    ```bash
    git commit -m "feat: Add a new feature that does X"
    ```
8.  **Push to your branch:**
    ```bash
    git push origin your-feature-branch-name
    ```
9.  **Submit a Pull Request:** Go to your fork on GitHub and click the "New pull request" button. Fill out the PR template with details about your changes.

### Pull Request Process

1.  Ensure your PR has a clear title and description, explaining *what* you changed and *why*.
2.  Link to any relevant issues in the description (e.g., "Closes #123").
3.  The core team will review your PR. We may suggest some changes or improvements.
4.  Once your PR is approved and all automated checks have passed, it will be merged into the `main` branch. Thank you for your contribution!

## Style Guides

We use **Black** for Python code formatting. Please run it on your code before committing to ensure a consistent style.

## Any Questions?

If you get stuck or have any questions, don't hesitate to ask in our [GitHub Discussions](https://github.com/EpicStaff/EpicStaff/discussions) or join our [Reddit Community](https://www.reddit.com/r/EpicStaff_AI/).

We're excited to see what you build with us!
