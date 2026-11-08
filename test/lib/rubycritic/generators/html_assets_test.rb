# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/generators/html_report'

describe 'HTML report assets' do
  let(:assets_dir) { Pathname.new(RubyCritic::Generator::HtmlReport::ASSETS_DIR) }
  let(:templates_dir) { assets_dir.join('../templates') }
  let(:layout_scripts) do
    templates_dir.join('layouts/application.html.erb').read
                 .scan(/<script src="<%= asset_path\("([^"]+)"\) %>">/).flatten
  end

  # Asset paths that the templates pass to asset_path, e.g. "images/logo.png".
  let(:template_references) do
    Dir[templates_dir.join('**/*.erb')].flat_map do |template|
      File.read(template).scan(/asset_path\(\s*["']([^"']+)["']\s*\)/).flatten
    end
  end

  # Files that the referenced stylesheets load with url(...), e.g. fonts.
  let(:stylesheet_references) do
    template_references.select { |path| path.end_with?('.css') }.flat_map do |stylesheet|
      css = assets_dir.join(stylesheet)
      css.read.scan(/url\(\s*["']?([^"')]+)["']?\s*\)/).flatten
         .reject { |url| url.start_with?('data:') }
         .map { |url| (css.dirname + url.sub(/[?#].*\z/, '')).relative_path_from(assets_dir).to_s }
    end
  end

  let(:references) { (template_references + stylesheet_references).uniq }

  let(:files) do
    Dir[assets_dir.join('**/*')].select { |path| File.file?(path) }
                                .map { |path| Pathname.new(path).relative_path_from(assets_dir).to_s }
  end

  it 'has a file for every asset that the templates and stylesheets reference' do
    _(references.reject { |path| files.include?(path) }).must_be_empty
  end

  it 'ships no asset that nothing references' do
    _(files - references).must_be_empty
  end

  it 'does not load Bootstrap JavaScript, because the report uses none of its plugins' do
    _(layout_scripts).wont_include 'vendor/javascripts/bootstrap.min.js'
  end
end
