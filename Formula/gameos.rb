class Gameos < Formula
  desc "Pure CLI local AI game studio runtime"
  homepage "https://github.com/aditya-elastic/gameos"
  url "https://registry.npmjs.org/gameos/-/gameos-0.7.0.tgz"
  sha256 "4054815ac0463a9bbfa81f5661aa8a7de44632e6277388f15b56b92b3da83512"
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
