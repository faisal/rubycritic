# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/generators/html/syntax_highlighter'

describe RubyCritic::Generator::Html::SyntaxHighlighter do
  let(:source) do
    <<~RUBY
      # A comment
      class Foo
        def call(text = "<b>")
          <<~HTML
            <p>\#{text}</p>
          HTML
        end
      end
    RUBY
  end
  let(:lines) { RubyCritic::Generator::Html::SyntaxHighlighter.lines(source) }

  it 'returns one HTML string for each source line' do
    _(lines.size).must_equal source.lines.size
  end

  it 'returns an empty line for an empty source line' do
    _(RubyCritic::Generator::Html::SyntaxHighlighter.lines("a\n\nb\n")[1]).must_equal ''
  end

  it 'returns no lines for an empty file' do
    _(RubyCritic::Generator::Html::SyntaxHighlighter.lines('')).must_equal []
  end

  it 'puts no newline in any line' do
    _(lines.grep(/\n/)).must_be_empty
  end

  it 'marks keywords, comments and class names with Rouge token classes' do
    _(lines[0]).must_equal '<span class="c1"># A comment</span>'
    _(lines[1]).must_equal '<span class="k">class</span> <span class="nc">Foo</span>'
  end

  it 'keeps the indentation' do
    _(lines[2]).must_match(%r{\A  <span class="k">def</span>})
  end

  it 'escapes HTML in the source' do
    _(lines[2]).must_include '&lt;b&gt;'
    _(lines[2]).wont_include '<b>'
  end

  it 'closes every tag on the line that opens it, also inside a heredoc' do
    lines.each_with_index do |line, index|
      _(line.scan('<span').size).must_equal line.scan('</span>').size, "line #{index + 1}: #{line}"
    end
  end

  it 'highlights each line of a heredoc as a string' do
    _(lines[4]).must_include '<span class="sh">'
  end
end
