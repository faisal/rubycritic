# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/generators/html/line'
require 'rubycritic/core/smell'

describe RubyCritic::Generator::Html::Line do
  let(:file_directory) { Pathname.new('tmp/lib') }
  let(:html) { '<span class="k">def</span> <span class="nf">foo</span>' }

  context 'without smells' do
    let(:line) { RubyCritic::Generator::Html::Line.new(file_directory, 3, html, []) }

    it 'renders the highlighted code as a list item with the line number as its id' do
      _(line.render).must_equal %(<li id="L3">#{html}</li>)
    end
  end

  context 'with smells' do
    let(:smell) do
      RubyCritic::Smell.new(type: 'UtilityFunction', analyser: 'reek', context: 'Foo#foo',
                            message: "doesn't depend on instance state",
                            locations: [RubyCritic::Location.new('lib/foo.rb', 3)])
    end
    let(:rendered) { RubyCritic::Generator::Html::Line.new(file_directory, 3, html, [smell]).render }

    it 'puts the smells after the code, inside the same list item' do
      _(rendered).must_match(%r{\A<li id="L3">#{Regexp.escape(html)}<ol class="nocode errors smells">.*</ol></li>\z}m)
    end

    it 'names the smell' do
      _(rendered).must_include 'UtilityFunction'
      _(rendered).must_include "Foo#foo doesn't depend on instance state"
    end

    it 'puts no newline in the output, because code lines keep their white space' do
      _(rendered).wont_include "\n"
    end
  end
end
