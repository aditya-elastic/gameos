class Gameos < Formula
  desc "Pure CLI local AI game studio runtime"
  homepage "https://github.com/aditya-elastic/gameos"
  url "https://registry.npmjs.org/gameos/-/gameos-0.4.1.tgz"
  sha256 "cde57205b3376f66fc159d1b73fa03a81ff50f7fbc22daed92efee3c562806cc"
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
