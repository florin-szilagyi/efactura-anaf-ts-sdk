# typed: false
# frozen_string_literal: true

# Source formula template for the standalone `anaf-cli` Homebrew tap.
#
# This file is the template; the CI release pipeline (cli-release.yaml,
# `homebrew` job) substitutes REPLACE_WITH_* markers and pushes the rendered
# formula to `florin-szilagyi/homebrew-anaf-cli` on every tagged CLI release.
#
# Intel macs are not shipped — Apple Silicon binaries run under Rosetta. For
# Intel-only Linux, install via `npm i -g @florinszilagyi/anaf-cli`.
#
# Install:
#   brew tap florin-szilagyi/anaf-cli
#   brew install anaf-cli
class AnafCli < Formula
  desc "CLI for the Romanian ANAF e-Factura SDK (anaf-ts-sdk)"
  homepage "https://github.com/florin-szilagyi/ts-anaf"
  license "MIT"
  version "REPLACE_WITH_VERSION"

  on_macos do
    on_arm do
      url "https://github.com/florin-szilagyi/ts-anaf/releases/download/cli-v#{version}/anaf-cli-#{version}-darwin-arm64.tar.gz"
      sha256 "REPLACE_WITH_DARWIN_ARM64_SHA256"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/florin-szilagyi/ts-anaf/releases/download/cli-v#{version}/anaf-cli-#{version}-linux-x64.tar.gz"
      sha256 "REPLACE_WITH_LINUX_X64_SHA256"
    end
  end

  def install
    bin.install "anaf-cli"
  end

  test do
    # Verify the binary reports its version, matches the formula version,
    # and can print a manifest JSON Schema (exercises the full bundle).
    assert_match version.to_s, shell_output("#{bin}/anaf-cli --version")
    schema = shell_output("#{bin}/anaf-cli schema print UblBuild")
    assert_match(/"\\$schema"/, schema)
  end
end
