class Gameos < Formula
  desc "Pure CLI local AI game studio runtime"
  homepage "https://github.com/aditya-elastic/gameos"
  url "https://registry.npmjs.org/gameos/-/gameos-0.5.0.tgz"
  sha256 "9b6a994361464dea3267ef227530e8881803f87cb7c274227d3f677500c051a8"
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
