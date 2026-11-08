# frozen_string_literal: true

require 'test_helper'
require 'tmpdir'
require 'rubycritic/configuration'
require 'rubycritic/core/analysed_module'
require 'rubycritic/core/smell'
require 'rubycritic/generators/html/code_file'

describe RubyCritic::Generator::Html::CodeFile do
  let(:source) do
    <<~RUBY
      class Foo
        def bar
          baz(1)
        end

        def qux
          baz(1)
        end
      end
    RUBY
  end

  around do |test|
    Dir.mktmpdir do |dir|
      @path = Pathname.new(File.join(dir, 'foo.rb'))
      @path.write(source)
      RubyCritic::Config.set(root: dir)
      test.call
    end
  end

  let(:smell) do
    RubyCritic::Smell.new(type: 'DuplicateCode', context: 'Foo', message: 'has identical code', cost: 1,
                          analyser: 'flay', locations: [RubyCritic::Location.new(@path, 2),
                                                        RubyCritic::Location.new(@path, 6)])
  end
  let(:analysed_module) do
    RubyCritic::AnalysedModule.new(pathname: @path, name: 'Foo', smells: [smell], complexity: 0, churn: 1)
  end
  let(:html) { RubyCritic::Generator::Html::CodeFile.new(analysed_module).render }
  # Only the code block, so that a failure message stays short.
  let(:code) { html[%r{<code class="[^"]*js-file-code[^"]*">.*</code>}m] || html[/<code.*/m] }
  let(:line_ids) { code.scan(/<li id="(L\d+)">/).flatten }

  it 'renders the code as an ordered list with one item per source line' do
    _(code).must_include '<ol class="linenums"><li id="L1">'
    _(line_ids).must_equal((1..source.lines.size).map { |number| "L#{number}" })
  end

  it 'highlights the code in Ruby, when the report is generated' do
    _(code).must_include '<li id="L1"><span class="k">class</span> <span class="nc">Foo</span></li>'
  end

  it 'shows the smells inside the item of the line they are on' do
    smelly = '<ol class="nocode errors smells">'

    _(code).must_include %(<li id="L2">  <span class="k">def</span> <span class="nf">bar</span>#{smelly})
    _(code).must_include %(<li id="L6">  <span class="k">def</span> <span class="nf">qux</span>#{smelly})
  end

  it 'links each smell location to the id of the line it is on' do
    hrefs = code.scan(/<a href="([^"]+)" class="js-smell-location">/).flatten.uniq

    _(hrefs).must_equal ['foo.html#L2', 'foo.html#L6']
    _(line_ids).must_include 'L2'
    _(line_ids).must_include 'L6'
  end

  it 'needs no client-side highlighter' do
    _(code).wont_include 'prettyprint'
  end
end
