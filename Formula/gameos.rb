class Gameos < Formula
  desc "Pure CLI local AI game studio runtime"
  homepage "https://github.com/aditya-elastic/gameos"
  url "https://registry.npmjs.org/gameos/-/gameos-0.4.0.tgz"
  sha256 "cf41ee6798c5fd1c66a0943f11a27322c17c2af92124b5edaf265260284199d9"
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
