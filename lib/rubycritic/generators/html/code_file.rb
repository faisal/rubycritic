# frozen_string_literal: true

require 'rubycritic/generators/html/base'
require 'rubycritic/generators/html/line'
require 'rubycritic/generators/html/syntax_highlighter'

module RubyCritic
  module Generator
    module Html
      class CodeFile < Base
        LINE_NUMBER_OFFSET = 1
        TEMPLATE = erb_template('code_file.html.erb')

        def initialize(analysed_module)
          @analysed_module = analysed_module
          @pathname = @analysed_module.pathname
          set_header_links if Config.compare_branches_mode?
        end

        def set_header_links
          @base_path = code_index_path(Config.base_root_directory, file_location)
          @feature_path = code_index_path(Config.feature_root_directory, file_location)
          @build_path = code_index_path(Config.compare_root_directory, file_location)
        end

        def file_directory
          @file_directory ||= root_directory + @pathname.dirname
        end

        def file_name
          @pathname.basename.sub_ext('.html')
        end

        def file_location
          @pathname.sub_ext('.html')
        end

        def render
          file_body = TEMPLATE.result(base_binding { file_code })
          LAYOUT_TEMPLATE.result(base_binding { file_body })
        end

        private

        # One <li id="L<n>"> per source line, with no white space between them.
        def file_code
          SyntaxHighlighter.lines(File.read(@pathname)).map.with_index(LINE_NUMBER_OFFSET) do |html, line_number|
            line_smells = @analysed_module.smells_at_location(Location.new(@pathname, line_number))
            Line.new(file_directory, line_number, html, line_smells).render
          end.join
        end
      end
    end
  end
end
