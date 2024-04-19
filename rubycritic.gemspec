# frozen_string_literal: true

lib = File.expand_path('lib', __dir__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'rubycritic/version'

Gem::Specification.new do |spec|
  spec.name          = 'rubycritic'
  spec.version       = RubyCritic::VERSION
  spec.authors       = ['Guilherme Simoes']
  spec.email         = ['guilherme.rdems@gmail.com']
  spec.description   = 'RubyCritic is a tool that wraps around various static analysis gems ' \
                       'to provide a quality report of your Ruby code.'
  spec.summary       = 'RubyCritic is a Ruby code quality reporter'
  spec.homepage      = 'https://github.com/whitesmith/rubycritic'
  spec.license       = 'MIT'
  spec.required_ruby_version = '>= 3.1.0'

  spec.files = [
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'Gemfile',
    'LICENSE.txt',
    'README.md',
    'ROADMAP.md',
    'Rakefile'
  ]
  spec.files += `git ls-files lib`.split("\n")

  spec.executables   = `git ls-files -- bin/*`.split("\n").map { |f| File.basename(f) }
  spec.require_path  = 'lib'

  spec.add_runtime_dependency 'flay'
  spec.add_runtime_dependency 'flog'
  spec.add_runtime_dependency 'launchy'
  spec.add_runtime_dependency 'parser'
  spec.add_runtime_dependency 'rainbow'
  spec.add_runtime_dependency 'reek', '< 7.0'
  spec.add_runtime_dependency 'rexml'
  spec.add_runtime_dependency 'ruby_parser'
  spec.add_runtime_dependency 'simplecov'
  spec.add_runtime_dependency 'tty-which'
  spec.add_runtime_dependency 'virtus'

  spec.add_development_dependency 'aruba'
  spec.add_development_dependency 'bundler'
  if RUBY_PLATFORM == 'java'
    spec.add_development_dependency 'pry-debugger-jruby'
  else
    spec.add_development_dependency 'byebug'
  end
  spec.add_development_dependency 'cucumber', '!= 9.0.0'
  spec.add_development_dependency 'diff-lcs'
  spec.add_development_dependency 'fakefs'
  spec.add_development_dependency 'mdl'
  spec.add_development_dependency 'minitest'
  spec.add_development_dependency 'minitest-around'
  spec.add_development_dependency 'mocha'
  spec.add_development_dependency 'rake'
  spec.add_development_dependency 'rexml'
  spec.add_development_dependency 'rubocop'
  spec.add_development_dependency 'rubocop-minitest'
  spec.add_development_dependency 'rubocop-performance'
  spec.add_development_dependency 'rubocop-rake'
  spec.metadata['rubygems_mfa_required'] = 'true'
end
