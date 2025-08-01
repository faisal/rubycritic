# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/analysers/smells/flay'
require 'rubycritic/core/analysed_module'
require 'pathname'

describe RubyCritic::Analyser::FlaySmells do
  context 'when analysing a bunch of files with duplicate code' do
    before do
      @analysed_modules = [
        RubyCritic::AnalysedModule.new(pathname: Pathname.new('test/samples/flay/smelly.rb')),
        RubyCritic::AnalysedModule.new(pathname: Pathname.new('test/samples/flay/smelly2.rb'))
      ]
      RubyCritic::Analyser::FlaySmells.new(@analysed_modules).run
    end

    it 'detects its smells' do
      _(@analysed_modules.first.smells?).must_equal true
    end

    it 'creates smells with messages' do
      smell = @analysed_modules.first.smells.first

      _(smell.message).must_be_instance_of String
    end

    it 'creates smells with scores' do
      smell = @analysed_modules.first.smells.first

      _(smell.score).must_be_kind_of Numeric
    end

    it 'creates smells with more than one location' do
      smell = @analysed_modules.first.smells.first

      _(smell.multiple_locations?).must_equal true
    end

    it 'calculates the mass of duplicate code' do
      _(@analysed_modules.first.duplication).must_be(:>, 0)
    end
  end

  context 'when some files are ignored using .flayignore' do
    before do
      FileUtils.ln_s('test/samples/flay/.flayignore', '.')
      @analysed_modules = [
        RubyCritic::AnalysedModule.new(pathname: Pathname.new('test/samples/flay/smelly.rb')),
        RubyCritic::AnalysedModule.new(pathname: Pathname.new('test/samples/flay/smelly2.rb'))
      ]
      RubyCritic::Analyser::FlaySmells.new(@analysed_modules).run
    end

    after do
      FileUtils.rm(%w[.flayignore])
    end

    it "doesn't detect smells for the ignored files" do
      _(@analysed_modules.first.smells?).must_equal false
    end

    it 'still detects smells for non-ignored files' do
      _(@analysed_modules.last.smells?).must_equal true
    end
  end
end
