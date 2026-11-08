# frozen_string_literal: true

require 'rubycritic/generators/html/base'

module RubyCritic
  module Generator
    module Html
      class Line < Base
        NORMAL_TEMPLATE = erb_template('line.html.erb')
        SMELLY_TEMPLATE = erb_template('smelly_line.html.erb')

        attr_reader :file_directory

        # html is one line of highlighted, already escaped code.
        def initialize(file_directory, number, html, smells)
          @file_directory = file_directory
          @number = number
          @html = html
          @smells = smells
        end

        # The code block keeps white space, so the output has no newlines.
        def render
          template.result(binding).delete("\n")
        end

        private

        def template
          if @smells.empty?
            NORMAL_TEMPLATE
          else
            SMELLY_TEMPLATE
          end
        end
      end
    end
  end
end
