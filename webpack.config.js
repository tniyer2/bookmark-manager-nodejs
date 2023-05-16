
const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const isProduction = process.env.NODE_ENV == "production";
const stylesHandler = MiniCssExtractPlugin.loader;


const OUTPUT_PATH = "./front_end/dist";

const resolvePath = (p) => path.resolve(__dirname, p);

COMMON_EXCLUDED_CHUNKS = ["content", "scanner"];

const config = {
    devtool: "source-map",
    entry: {
        background: "./front_end/js/background.js",
        popup: "./front_end/js/popup.js",
        gallery: "./front_end/js/gallery.js",
        singleView: "./front_end/js/singleView.js",
        settings: "./front_end/js/settings.js",
        content: "./front_end/js/content.js",
        scanner: "./front_end/js/scanner.js"
    },
	optimization: {
		splitChunks: {
			cacheGroups: {
				commons: {
					name: "commons",
					chunks: (chunk) =>
                        COMMON_EXCLUDED_CHUNKS.indexOf(chunk.name) === -1,
					minChunks: 2,
					minSize: 0
				}
			}
		},
		chunkIds: "deterministic"
	},
    output: {
        path: resolvePath(OUTPUT_PATH)
    },
    devServer: {
        open: true,
        host: "localhost"
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./front_end/html/background.html",
            filename: "background.html",
            chunks: ["background"]
        }),
        new HtmlWebpackPlugin({
            template: "./front_end/html/popup.html",
            filename: "popup.html",
            chunks: ["popup"]
        }),
        new HtmlWebpackPlugin({
            template: "./front_end/html/gallery.html",
            filename: "gallery.html",
            chunks: ["gallery"]
        }),
        new HtmlWebpackPlugin({
            template: "./front_end/html/singleView.html",
            filename: "singleView.html",
            chunks: ["singleView"]
        }),
        new HtmlWebpackPlugin({
            template: "./front_end/html/settings.html",
            filename: "settings.html",
            chunks: ["settings"]
        }),
        new MiniCssExtractPlugin(),
        new CopyPlugin({
            patterns: [
                { from: "./front_end/manifest.json", to: "./manifest.json" },
                { from: "./front_end/taggle.js", to: "./taggle.js" },
                { from: "./front_end/css", to: "./css" },
                { from: "./front_end/icons", to: "./icons" }
            ],
        })
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/i,
                loader: "babel-loader"
            },
            {
                test: /\.s[ac]ss$/i,
                use: [stylesHandler, "css-loader", "postcss-loader", "sass-loader"]
            },
            {
                test: /\.css$/i,
                use: [stylesHandler, "css-loader", "postcss-loader"]
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: "asset"
            },
            {
                test: /\.(png|jpe?g|gif)$/i,
                loader: "file-loader"
            }
        ]
    }
};

module.exports = () => {
    if (isProduction) {
        config.mode = "production";
    } else {
        config.mode = "development";
    }

    return config;
};
