# Live Subtitles

This is an AI-powered live subtitles application built with Tauri, React, and Rust.

## Windows Distribution (.exe)

I have prepared the project for Windows distribution. To generate the `.exe` and `.msi` files, follow these steps:

1. **GitHub Actions**: Push your code to a GitHub repository.
2. **Release**: Create a new tag (e.g., `git tag v0.1.0` and `git push origin v0.1.0`).
3. **Download**: Navigate to the "Releases" tab on GitHub. The Windows executable will be automatically built and attached to the release draft.

### Technical Improvements Made:
- **Conditional Dependencies**: Fixed `Cargo.toml` so the macOS-specific APIs don't break the Windows compilation.
- **Workflow Optimization**: Refined the CI/CD pipeline to automatically name releases based on your version tags.

## Final Status
- [x] Mac Development Environment: Running
- [x] Windows Build Configuration: Ready
- [x] Cross-Platform Rust Logic: Verified

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
