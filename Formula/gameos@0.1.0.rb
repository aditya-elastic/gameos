class GameosAT010 < Formula
  desc "Pure CLI local AI game studio runtime"
  homepage "https://github.com/aditya-elastic/gameos"
  url "https://registry.npmjs.org/gameos/-/gameos-0.1.0.tgz"
  sha256 "7161a5f6313f36bad5cfc04499f67d6d45e807079c7fa69c011b7e889cd10bbd"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/gameos"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/gameos --version")
    assert_match '"telemetry": false', shell_output("#{bin}/gameos doctor --json")
  end
end
