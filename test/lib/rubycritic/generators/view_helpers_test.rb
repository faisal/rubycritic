# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/generators/html/view_helpers'
require 'pathname'

describe RubyCritic::ViewHelpers do
  context 'when the file is in the root directory' do
    let(:generator) { GeneratorDouble.new('foo.html') }

    describe '#file_path' do
      context 'when the other file is in the same directory' do
        it 'creates a relative path to a file' do
          _(generator.file_path('bar.html').to_s).must_equal 'bar.html'
        end
      end

      context 'when the other file is in a subdirectory' do
        it 'creates a relative path to a file' do
          _(generator.file_path('subdirectory/bar.html').to_s).must_equal 'subdirectory/bar.html'
        end
      end
    end

    describe '#asset_path' do
      it 'creates a relative path to an asset' do
        _(generator.asset_path('stylesheets/application.css').to_s)
          .must_equal 'assets/stylesheets/application.css'
      end
    end

    describe '#icon' do
      %w[bars dashboard code warning umbrella arrow-up arrow-down].each do |name|
        it "returns the #{name} icon as one line of inline SVG that screen readers skip" do
          svg = generator.icon(name)

          _(svg).must_match(/\A<svg class="icon icon-#{name}" /)
          _(svg).must_include 'viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path '
          _(svg).must_match(%r{</svg>\z})
          _(svg).wont_include "\n"
        end
      end

      it 'raises an error for an unknown icon' do
        _ { generator.icon('no-such-icon') }.must_raise ArgumentError
      end
    end

    describe '#timeago_tag' do
      context 'with a git or Perforce commit date' do
        it 'gives the time element an ISO 8601 datetime and keeps the original text' do
          _(generator.timeago_tag('2018-10-31 18:01:36 -0300'))
            .must_equal "<time class='js-timeago' datetime='2018-10-31T18:01:36-03:00'>2018-10-31 18:01:36 -0300</time>"
        end
      end

      context 'with a Mercurial commit date, which has no seconds' do
        it 'gives the time element an ISO 8601 datetime' do
          _(generator.timeago_tag('2018-10-31 18:01 -0300'))
            .must_include "datetime='2018-10-31T18:01:00-03:00'"
        end
      end

      context 'with a date it cannot parse' do
        it 'keeps the original text as the datetime' do
          _(generator.timeago_tag('not a date'))
            .must_equal "<time class='js-timeago' datetime='not a date'>not a date</time>"
        end
      end
    end
  end

  context 'when the file is n directories deep' do
    let(:generator) { GeneratorDouble.new('lets/go/crazy/foo.html') }

    describe '#file_path' do
      context 'when the other file is in the same directory' do
        it 'creates a relative path to a file' do
          _(generator.file_path('lets/go/crazy/bar.html').to_s).must_equal 'bar.html'
        end
      end

      context 'when the other file is in the root directory' do
        it 'creates a relative path to a file' do
          _(generator.file_path('bar.html').to_s).must_equal '../../../bar.html'
        end
      end

      context 'when the other file has n-1 directories in common' do
        it 'creates a relative path to a file' do
          _(generator.file_path('lets/go/home/bar.html').to_s).must_equal '../home/bar.html'
        end
      end

      context 'when the other file is one directory deeper' do
        it 'creates a relative path to a file' do
          _(generator.file_path('lets/go/crazy/everybody/bar.html').to_s).must_equal 'everybody/bar.html'
        end
      end
    end

    describe '#asset_path' do
      it 'creates a relative path to an asset' do
        _(generator.asset_path('stylesheets/application.css').to_s)
          .must_equal '../../../assets/stylesheets/application.css'
      end
    end
  end
end

class GeneratorDouble
  include RubyCritic::ViewHelpers

  def initialize(file)
    @file = Pathname.new(file)
  end

  def file_directory
    root_directory + @file.dirname
  end

  def root_directory
    Pathname.new('root_directory')
  end
end
