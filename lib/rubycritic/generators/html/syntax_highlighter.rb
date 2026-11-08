# frozen_string_literal: true

require 'rouge'

module RubyCritic
  module Generator
    module Html
      # Highlights Ruby source with Rouge when the report is generated.
      # Rouge's own HTMLLinewise formatter is "an example implementation only",
      # so this small formatter gives one HTML string per source line instead.
      class SyntaxHighlighter < Rouge::Formatters::HTML
        def self.lines(source)
          new.lines(source)
        end

        # token_lines splits tokens that span lines, such as heredocs, so each
        # line closes the tags it opens.
        def lines(source)
          token_lines(Rouge::Lexers::Ruby.new.lex(source)).map { |tokens| line_html(tokens) }
        end

        private

        def line_html(tokens)
          tokens.map { |token, value| span(token, value) }.join
        end
      end
    end
  end
end
